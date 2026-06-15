require("dotenv").config();

const app = require("./app");

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

const server = app.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});

// Attach the real-time session sync WebSocket hub to the same HTTP server so it
// shares the listening port (and any reverse-proxy WebSocket upgrade config).
app.sessionSyncHub.attach(server);

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down`);
  app.sessionSyncHub.close();
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
