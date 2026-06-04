# Android App Setup

## Supabase Auth

Add these values to `MyApplication/local.properties`:

```properties
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
WEB_SERVER_URL=http://10.0.2.2:3000
```

Use the anon/publishable key in the Android app. Do not put the Supabase service role key in Android.

In Supabase, add this redirect URL:

```text
drp37://auth-callback
```

Google and email login are wired from the login screen. When Supabase reports an authenticated session, the app switches to the blocker setup screen.

## App Blocking

Active app blocking uses the Tether accessibility service. Before starting a block session, enable Tether in Android Accessibility settings. If the service is not enabled, the app opens Accessibility settings instead of recording a session.

During an active session, opening a selected app sends the device back to the home screen.
