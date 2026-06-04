# Supabase configuration
This project uses Supabase for authentication and as a database.

## Environment

Add these values to `WindowsApp/.env`:

```properties
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_WEB_SERVER_URL=http://localhost:3000
```

`VITE_WEB_SERVER_URL` is required for cross-platform block-session sync. The Windows app sends selected websites to the web server, receives expanded domains/process tokens, and restores active sessions from `GET /api/session/current`.

## Google sign-in (desktop)

Sign in with Google opens the system browser. After consent, Supabase redirects to a local callback URL; Tether receives the auth code on `127.0.0.1` and completes the session.

In **Supabase Dashboard → Authentication → URL Configuration**, add this redirect URL:

```text
http://127.0.0.1:17892/auth/callback
```

No database or table changes are required for Google login.

The required database schema is as follows:

Table Name: `onboarding`

| Column | Type | Description |
| --- | --- | --- |
| `id` | `uuid` | Primary key for the onboarding row |
| `user_id` | `uuid` | The authenticated Supabase user ID |
| `do_more_of` | `text[]` | Activities the user wants to do more of |
| `scrolling_worst` | `text[]` | Situations where scrolling is worst for the user |
| `future_message` | `text` | Message written by the user to their future self |
| `strictness` | `text` | User's preferred blocking/reminder strictness |
| `created_at` | `timestamptz` | When the row was created |

`user_id` is a UNIQUE key and should be linked to `auth.users` table via `auth.users.id`.

Table Name: `focus_session_points`

| Column | Type | Description |
| --- | --- | --- |
| `id` | `uuid` | Primary key for the points event row |
| `user_id` | `uuid` | The authenticated Supabase user ID |
| `mode` | `text` | Session severity mode (`breathing`, `reflect`, `hard`) |
| `actual_ms` | `integer` | Actual blocked duration in milliseconds |
| `planned_ms` | `integer` | Planned session duration in milliseconds |
| `blocked_apps_count` | `integer` | Number of apps blocked in that session |
| `points` | `integer` | Points awarded for that completed session |
| `ended_at` | `timestamptz` | When the session ended |
| `created_at` | `timestamptz` | When the points row was created |

`focus_session_points.user_id` should be linked to `auth.users.id`.