import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase credentials. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env file'
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function signUpWithEmail(email, password) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });
    if (error) throw error;
    return data;
}

export async function signInWithEmail(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    if (error) throw error;
    return data;
}

export async function signInWithGoogle() {
    // Desktop OAuth: get the provider consent URL without redirecting this
    // window, open it in a popup (handled in the main process), and exchange
    // the returned tokens for a session. Avoids bouncing the app to the
    // Supabase Site URL. Requires the Electron bridge.
    if (!window.tether?.oauthLogin) {
        throw new Error('Google sign-in is only available in the desktop app.');
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Could not start Google sign-in.');

    const tokens = await window.tether.oauthLogin(data.url);
    if (!tokens?.access_token) {
        throw new Error('Google sign-in was cancelled.');
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
    });
    if (sessionError) throw sessionError;
    return sessionData; // onAuthStateChange fires -> AuthGate advances
}

export async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

export async function checkOnboardingComplete(userId) {
    const { data, error } = await supabase
        .from('onboarding')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw error;
    return !!data;
}

export async function saveOnboarding(userId, responses) {
    const { data, error } = await supabase
        .from('onboarding')
        .upsert({
            user_id: userId,
            do_more_of: responses.doMoreOf,
            scrolling_worst: responses.scrollingWorst,
            future_message: responses.futureMessage,
            strictness: responses.strictness,
        }, { onConflict: 'user_id' });
    if (error) throw error;
    return data;
}
