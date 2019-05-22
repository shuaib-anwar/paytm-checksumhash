const Express = require("express");

const app = Express();

app.use(function(request, response, next) {
    response.header("Access-Control-Allow-Origin", "*");
    response.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get("/", (request, response) => {
    response.send("Hello World");
});

app.listen(3000, () => {
    console.log("Listening on port 3000...");
});
