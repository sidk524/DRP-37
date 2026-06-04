// Configuration for the L1 "Mindful" blocker.
//
// Matching is case-insensitive and strips a trailing ".exe", then does a
// substring match against the foreground process name. So "instagram" matches
// "Instagram.exe", "instagram", etc.
//
// `notepad` is included by default as an easy way to test the friction flow on
// Windows: open Notepad and the breathing overlay should appear.
module.exports = {
    // How often to check the foreground app, in milliseconds.
    pollIntervalMs: 1000,

    // After the user continues through (or dismisses) the friction screen for an
    // app, don't re-prompt for this long. Keeps L1 a gentle wedge, not a nag.
    graceMs: 5 * 60 * 1000,

    // Process names that trigger the friction screen.
    blocklist: ["instagram", "tiktok", "notepad"],

    // Never show the overlay over our own app (matched the same way as blocklist).
    ownAppNames: ["electron", "tether"],

    // Active blocking mode (the "3 step process"):
    //   "breathing" — breathe, then let through            (gentlest)
    //   "reflect"   — ask purpose + show your past message  (middle)
    //   "hard"      — no entry                              (strictest)
    // Eventually set per-app from BlockerSetup; one global mode for now.
    mode: "breathing",

    // The message your calmer, past self wrote — shown in "reflect" mode to
    // demotivate the impulse. Eventually sourced from onboarding / Supabase.
    selfMessage: "Future me wants to wake up proud, not tired. Is this worth it?",

    // Breathing animation tuning (read by the renderer via the friction:show event).
    breathSeconds: 4, // length of one inhale (and one exhale)
    breathCycles: 3, // full inhale+exhale cycles before auto-advancing
};
