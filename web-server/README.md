# DRP-37 Web Server

Basic Node.js and Express web server.

## Requirements

- Node.js 20 or newer
- npm

## Local Development

```sh
npm install
npm run dev
```

The server listens on `http://localhost:3000` by default.

## Scripts

- `npm start` starts the server with Node.
- `npm run dev` starts the server with Node's watch mode.

## Endpoints

- `GET /` returns basic server status.
- `GET /health` returns a health check response for load balancers or uptime checks.

## Deployment Notes

The server reads `PORT` and `HOST` from the environment. This is suitable for AWS services that inject a runtime port or require the app to bind to `0.0.0.0`.
