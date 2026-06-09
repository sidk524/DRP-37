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
- `GET /api/session/current` returns the authenticated user's active block session, or `null`.
- `PUT /api/session/current` starts or ends the authenticated user's active block session.
- `GET /api/onboarding` returns the authenticated user's onboarding settings, or `null`.
- `PUT /api/onboarding` upserts the authenticated user's onboarding settings.
- `POST /api/focus-points` records focus session points for the authenticated user.
- `GET /api/focus-points/total` returns the authenticated user's total focus points.

## Block Session Sync

Clients send the platform-native targets they know about:

```json
{
  "active": true,
  "appsBlocked": ["com.instagram.android"],
  "domainsBlocked": ["instagram.com"],
  "totalDurationSeconds": 1500
}
```

The server expands known targets through `src/blockTargetRegistry.js` and stores the full cross-platform payload in `block_sessions`:

| Column | Purpose |
| --- | --- |
| `canonical_targets` | Shared target IDs such as `instagram` or `youtube` |
| `apps_blocked` | Android package names used by the accessibility service |
| `domains_blocked` | Website hostnames used by the Windows Chrome/Edge extension bridge |
| `process_tokens` | Reserved Windows process match tokens, not used by the current extension-only blocker |

Unknown Android packages are stored only in `apps_blocked`. Unknown website domains are stored only in `domains_blocked`.

## Adding Registry Entries

Add entries in `src/blockTargetRegistry.js` with any fields that exist for that service:

```js
registerTarget({
    id: "example",
    packages: ["com.example.android"],
    domains: ["example.com", "www.example.com"],
    processTokens: ["example"],
    aliases: ["example app"]
});
```

If a service has no Android package or no website, omit that field. The server will only expand to the platforms it knows.

## Deployment Notes

The server reads `PORT` and `HOST` from the environment. This is suitable for AWS services that inject a runtime port or require the app to bind to `0.0.0.0`.
