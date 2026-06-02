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