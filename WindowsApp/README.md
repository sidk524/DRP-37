# Supabase configuration
This project uses Supabase for authentication and as a database.
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