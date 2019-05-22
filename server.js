const http = require('http');
const https = require('https');
const qs = require('querystring');
const port = 3000;
const checksum_lib = require('./checksum.js');
const cors = require('cors');

var PaytmConfig = {
	mid: "pEwPzj57976555121471",
	key: "n3vj#dwm%%p2GWJC",
	website: "localhost"
}

http.createServer(function (req, res) {
	res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
	res.setHeader('Access-Control-Allow-Origin', "*");
	res.setHeader('Access-Control-Request-Method', '*');
	res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
	res.setHeader('Access-Control-Allow-Headers', '*');

	switch(req.url){
		case "/":
			res.setHeader('Content-Type', 'application/json');
			res.statusCode = 200;
    		res.end(JSON.stringify({ RESPMSG: "Root API Called with success" }));
		break;

		case "/getCheckSum": 
		console.log("Headers:", req.headers)
			var payload = '';
		    req.on('data', chunk => {
		        payload += chunk.toString(); // convert Buffer to string
		    });

		    req.on('end', () => {
		        res.setHeader('Content-Type', 'application/json');
				res.statusCode = 200;

				checksum_lib.genchecksum(payload, PaytmConfig.key, function (err, checksum) {
					res.setHeader('Content-Type', 'application/json');
					res.statusCode = 200;
		    		res.end(JSON.stringify({ CHECKSUMHASH: checksum }));
				});
	    		
		    });

		break;

		case "/processTransaction":
			var body = '';
	        
	        req.on('data', function (data) {
	            body += data;
	        });

	        req.on('end', function () {
				var html = "";
				var params = qs.parse(body);
				console.log(params);
				checksum_lib.genchecksum(params, PaytmConfig.key, function (err, checksum) {

					var txn_url = "https://securegw-stage.paytm.in/theia/processTransaction"; // for staging
					// var txn_url = "https://securegw.paytm.in/theia/processTransaction"; // for production
					
					var form_fields = "";

					for(var x in params) {
						form_fields += "<input type='hidden' name='"+x+"' value='"+params[x]+"' >";
					}

					form_fields += "<input type='hidden' name='CHECKSUMHASH' value='"+checksum+"' >";

					res.writeHead(200, {'Content-Type': 'text/html'});
					res.write('<html><head><title>Merchant Checkout Page</title></head><body><center><h1>Please do not refresh this page...</h1></center><form method="post" action="'+txn_url+'" name="f1">'+form_fields+'</form><script type="text/javascript">document.f1.submit();</script></body></html>');
					res.end();
				});
			});
		break;

		case "/callback":
			var body = '';
	        
	        req.on('data', function (data) {
	            body += data;
	        });

	        req.on('end', function () {
				// var post_data = qs.parse(body);

				res.writeHead(301, { Location: 'https://localhost:8200/search-bus/confirmation?'+ body.toString() });
				res.end();
	        });
			
		break;

		case "/orderConfirmation": 
			var post_data = '';
		    req.on('data', chunk => {
		        post_data += chunk.toString(); // convert Buffer to string
		    });

		    req.on('end', () => {
				var responseData = {};
		    	post_data = JSON.parse(post_data);
		    	
		        var checksumhash = post_data['CHECKSUMHASH'];
		        
				var result = checksum_lib.verifychecksum(post_data, PaytmConfig.key, checksumhash);

				responseData.CHECKSUMHASH_RESULT =  result;
	    		
	    		var params = {"MID": PaytmConfig.mid, "ORDERID": post_data.ORDERID};

				checksum_lib.genchecksum(params, PaytmConfig.key, function (err, checksum) {

					params.CHECKSUMHASH = checksum;
					post_data = 'JsonData='+JSON.stringify(params);

					var options = {
						hostname: 'securegw-stage.paytm.in', // for staging
						// hostname: 'securegw.paytm.in', // for production
						port: 443,
						path: '/merchant-status/getTxnStatus',
						method: 'POST',
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
							'Content-Length': post_data.length
						}
					};

					// Set up the request
					var response = "";
					var post_req = https.request(options, function(post_res) {
						post_res.on('data', function (chunk) {
							response += chunk;
						});

						post_res.on('end', function(){
							responseData.S2S_Response = JSON.parse(response);

							res.writeHead(200, {'Content-Type': 'application/json'});
							res.write(JSON.stringify(responseData, null, 2));
							
							res.end();
						});
					});

					// post the data
					post_req.write(post_data);

					post_req.end();
				});
		    });

		break;
	
		case "/callback2":

			var body = '';
	        
	        req.on('data', function (data) {
	            body += data;
	        });

	        req.on('end', function () {
				var html = "";
				var post_data = qs.parse(body);
				var responseData = [];


				// received params in callback
				console.log('Callback Response: ', post_data, "\n");
				responseData.push({call_back_response: post_data});

				html += "<b>Callback Response</b><br>";
				for(var x in post_data){
					html += x + " => " + post_data[x] + "<br/>";
				}
				html += "<br/><br/>";


				// verify the checksum
				var checksumhash = post_data.CHECKSUMHASH;
				// delete post_data.CHECKSUMHASH;
				var result = checksum_lib.verifychecksum(post_data, PaytmConfig.key, checksumhash);
				console.log("Checksum Result => ", result, "\n");
				responseData.push({ checksumhash_result: result });

				html += "<b>Checksum Result</b> => " + (result? "True" : "False");
				html += "<br/><br/>";


				// Send Server-to-Server request to verify Order Status
				var params = {"MID": PaytmConfig.mid, "ORDERID": post_data.ORDERID};

				checksum_lib.genchecksum(params, PaytmConfig.key, function (err, checksum) {

					params.CHECKSUMHASH = checksum;
					post_data = 'JsonData='+JSON.stringify(params);

					var options = {
						hostname: 'securegw-stage.paytm.in', // for staging
						// hostname: 'securegw.paytm.in', // for production
						port: 443,
						path: '/merchant-status/getTxnStatus',
						method: 'POST',
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
							'Content-Length': post_data.length
						}
					};


					// Set up the request
					var response = "";
					var post_req = https.request(options, function(post_res) {
						post_res.on('data', function (chunk) {
							response += chunk;
						});

						post_res.on('end', function(){
							console.log('S2S Response: ', response, "\n");
							responseData.push({ S2S_Response: JSON.parse(response) });

							var _result = JSON.parse(response);
							html += "<b>Status Check Response</b><br>";
							for(var x in _result){
								html += x + " => " + _result[x] + "<br/>";
							}

							// res.writeHead(200, {'Content-Type': 'text/html'});
							// res.write(html);
							
							res.writeHead(200, {'Content-Type': 'application/json'});
							// res.writeHead(301, { Location: 'https://localhost:8200/search-bus/confirmation?data='+ JSON.stringify(responseData)});
							res.write(JSON.stringify(responseData, null, 2));
							
							res.end();
						});
					});

					// post the data
					post_req.write(post_data);

					post_req.end();
				});
	        });
			
		break;
	}
	

}).listen(port, function() {
	console.log('API Running on', port);
})
