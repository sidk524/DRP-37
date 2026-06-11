# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Tether** (DRP-37) is a cross-platform digital wellbeing app that blocks distracting apps and websites. It has three sub-projects:

- **`MyApplication/`** — Android app (Kotlin/Jetpack Compose). Blocks apps via an `AccessibilityService`.
- **`WindowsApp/`** — Desktop app (Electron + React). Blocks websites via a Chrome/Edge extension bridge.
- **`web-server/`** — Node.js/Express API (deployed to AWS EC2). Syncs block sessions across platforms.
- **`supabase/migrations/`** — SQL migrations that must be applied in numbered order.

## Commands

### Web server (`web-server/`)
```sh
npm install
npm run dev        # watch mode
npm test           # Jest tests
```

### Windows app (`WindowsApp/`)
```sh
npm install
npm run dev        # Vite + Electron (concurrently)
npm test           # Node test runner (src/main/**/*.test.js)
npm run dist       # build installer
```

### Android app (`MyApplication/`)
```sh
./gradlew assembleDebug
./gradlew test                    # unit tests
./gradlew connectedAndroidTest    # instrumented tests (device required)
```

## Architecture

### Cross-platform session sync

Clients send the apps/sites they want to block plus a duration to `PUT /api/session/current`. The server runs the payload through `web-server/src/expandBlockTargets.js`, which looks up each item in `blockTargetRegistry.js` and expands it into:
- `canonical_targets` — shared IDs like `instagram`
- `apps_blocked` — Android package names
- `domains_blocked` — website hostnames for the Chrome/Edge extension
- `process_tokens` — reserved for future Windows process blocking

Both the Android and Windows clients `GET /api/session/current` on startup to restore an in-progress session. All API requests carry a Supabase JWT in the `Authorization: Bearer` header, verified by the `requireUser` middleware in `app.js`.

### Android app

- `TetherLocalStore` (singleton, SharedPreferences) is the source of truth for the accessibility service — it stores the active session and temporary allow windows.
- `AppBlockingAccessibilityService` monitors `TYPE_WINDOW_STATE_CHANGED` events and launches `MainActivity` with `ACTION_SHOW_FRICTION` when a blocked package is detected.
- Session modes: `breathing`, `reflect`, `hard`. Hard mode ignores temporary allow grants.
- UI is Jetpack Compose; `BlockerSessionViewModel` drives session state.

### Windows app (Electron)

Main process (`src/main/index.js`) owns:
- **`authService`** — Supabase auth via email/password or Google OAuth (local callback on port 17892).
- **`webServerService`** — proxies renderer calls to the remote web server so CORS is avoided.
- **`blockerService`** — owns block session state and exposes it via a local HTTP server on `127.0.0.1:17894`.
- **`extensionBridge`** — the Chrome/Edge extension polls that local server to know which domains to block.

Renderer (`src/renderer/`) is a React SPA using `react-router-dom`. IPC channel names are centralised in `src/main/ipc/channels.js`. The renderer never calls Supabase or the web server directly; it goes through IPC to the main process.

### Adding a new blockable target

Edit `web-server/src/blockTargetRegistry.js`:
```js
registerTarget({
    id: "example",
    packages: ["com.example.android"],   // omit if no Android app
    domains: ["example.com"],             // omit if no website
    processTokens: ["example"],           // reserved, can omit
});
```

### Database migrations

Migrations live in `supabase/migrations/` and must be applied in numerical order (`001` → `005`). The server's `missingSchemaError` helper returns a `503` with a human-readable message if a required migration hasn't been run yet.

## Environment variables

**`web-server/.env`** (see `web-server/src/server.js`):
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
- `PORT`, `HOST` (optional, defaults to 3000 / localhost)

**`WindowsApp/.env`** (see `.env.example`):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_WEB_SERVER_URL` — URL of the deployed web server

**Android** — Supabase credentials are compiled in (see `TetherApplication.kt`).
