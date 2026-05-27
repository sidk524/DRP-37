require("dotenv").config();

const express = require("express");
const helmet = require("helmet");

const app = express();
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

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
  res.type("text").send("VERY HEALTHY. VERY AWESOME");
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

const server = app.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
