const express = require("express");
const helmet = require("helmet");

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json());

app.get("/", (_req, res) => {
    res.json({
        name: "DRP-37 web server",
        status: "ok"
    });
});

app.get("/health", (_req, res) => {
    res.type("text").send("VERY HEALTHY");
});

app.use((_req, res) => {
    res.status(404).json({
        error: "Not found"
    });
});

app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({
        error: "Internal server error"
    });
});

module.exports = app;