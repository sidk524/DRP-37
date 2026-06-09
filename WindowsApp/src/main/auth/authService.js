const { createClient } = require("@supabase/supabase-js");
const { getOAuthRedirectUrl } = require("./oauthConfig");
const { startBrowserOAuth } = require("./oauthBrowser");

let supabase = null;
let onSessionChange = null;

function getSupabaseUrl() {
    return process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
}

function getSupabaseKey() {
    return process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
}

function toSessionDto(session) {
    if (!session) return null;
    return {
        user: session.user,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
    };
}

function wrapError(error) {
    const err = new Error(error?.message || "Authentication failed.");
    err.name = error?.name || "AuthError";
    throw err;
}

function initialize({ onSessionChange: callback }) {
    onSessionChange = callback;

    const supabaseUrl = getSupabaseUrl();
    const supabaseKey = getSupabaseKey();
    if (!supabaseUrl || !supabaseKey) {
        throw new Error(
            "Missing Supabase credentials. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env"
        );
    }

    supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
            flowType: "pkce",
            detectSessionInUrl: false,
            autoRefreshToken: true,
        },
    });

    supabase.auth.onAuthStateChange((_event, session) => {
        if (onSessionChange) {
            onSessionChange(toSessionDto(session));
        }
    });
}

function getClient() {
    if (!supabase) {
        throw new Error("authService is not initialized.");
    }
    return supabase;
}

async function getSession() {
    const { data, error } = await getClient().auth.getSession();
    if (error) wrapError(error);
    return toSessionDto(data.session);
}

async function signInWithEmail({ email, password }) {
    const { data, error } = await getClient().auth.signInWithPassword({
        email,
        password,
    });
    if (error) wrapError(error);
    return toSessionDto(data.session);
}

async function signUpWithEmail({ email, password }) {
    const { data, error } = await getClient().auth.signUp({
        email,
        password,
    });
    if (error) wrapError(error);
    return {
        session: toSessionDto(data.session),
        user: data.user,
    };
}

async function signOut() {
    const { error } = await getClient().auth.signOut();
    if (error) wrapError(error);
}

async function signInWithGoogle() {
    const redirectTo = getOAuthRedirectUrl();

    const { data, error } = await getClient().auth.signInWithOAuth({
        provider: "google",
        options: {
            skipBrowserRedirect: true,
            redirectTo,
        },
    });
    if (error) wrapError(error);
    if (!data?.url) throw new Error("Could not start Google sign-in.");

    const callback = await startBrowserOAuth(data.url);

    if (callback?.code) {
        const { data: sessionData, error: sessionError } =
            await getClient().auth.exchangeCodeForSession(callback.code);
        if (sessionError) wrapError(sessionError);
        return toSessionDto(sessionData.session);
    }

    if (callback?.access_token) {
        const { data: sessionData, error: sessionError } = await getClient().auth.setSession({
            access_token: callback.access_token,
            refresh_token: callback.refresh_token,
        });
        if (sessionError) wrapError(sessionError);
        return toSessionDto(sessionData.session);
    }

    throw new Error("Google sign-in was cancelled.");
}

module.exports = {
    initialize,
    getClient,
    getSession,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    signInWithGoogle,
};
