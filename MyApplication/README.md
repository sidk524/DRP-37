# Android App Setup

## Supabase Auth

Add these values to `MyApplication/local.properties`:

```properties
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Use the anon/publishable key in the Android app. Do not put the Supabase service role key in Android.

In Supabase, add this redirect URL:

```text
drp37://auth-callback
```

Google and email login are wired from the login screen. When Supabase reports an authenticated session, the app switches to the blocker setup screen.
