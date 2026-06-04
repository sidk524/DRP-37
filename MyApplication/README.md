# Android App Setup

## Supabase Auth

Add these values to `MyApplication/local.properties`:

```properties
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Use the publishable key from the Supabase dashboard. Do not put the service role key in the Android app.

In Supabase, add this redirect URL:

```text
drp37://auth-callback
```

Google and email login are wired from the login screen. After sign-in, the app checks the Supabase `onboarding` table. If no row exists for the user, the four-step onboarding flow runs (same steps and dark UI as the Windows app), then blocker setup.

Ensure RLS policies on `onboarding` allow authenticated users to read and insert/upsert their own row (`user_id` = auth uid).
