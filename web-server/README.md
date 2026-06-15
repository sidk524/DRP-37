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

## Real-time session sync

Clients keep block sessions in sync across devices over a WebSocket hub
(`src/sessionSyncHub.js`) attached to the same HTTP server at:

```
/api/session/sync
```

- **REST stays the write path.** Clients start/stop sessions via
  `PUT /api/session/current` and change the friction mode via
  `PATCH /api/session/current` (`{ "mode": "breathing" | "reflect" | "hard" }`).
  The server persists the change to `block_sessions`, then **pushes** a
  `session.sync` frame to every other connected device for that user.
- **Auth.** The socket authenticates the same Supabase JWT used by REST, read
  from the `access_token` query param (Android) or the `bearer` WebSocket
  subprotocol. Invalid tokens are closed with code `4401`.
- **Echo suppression.** Each client sends a stable `X-Tether-Device-Id` header on
  REST calls and the same id in its WebSocket `hello`. The hub skips the
  originating device when broadcasting so a device never reacts to its own
  change.

Requires Supabase migration `007_session_mode_sync.sql` (adds `mode` and
`updated_at` to `block_sessions`).

### Reverse-proxy configuration

If the server runs behind nginx / an ALB on EC2, enable WebSocket upgrades for
the sync path, e.g. for nginx:

```nginx
location /api/session/sync {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
}
```

For an AWS ALB, use an HTTP/HTTPS listener (ALBs support WebSocket upgrades
natively) and raise the target group idle timeout above the 30s heartbeat.

## Deployment Notes

The server reads `PORT` and `HOST` from the environment. This is suitable for AWS services that inject a runtime port or require the app to bind to `0.0.0.0`.
