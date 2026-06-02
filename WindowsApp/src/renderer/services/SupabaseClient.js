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
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return data;
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
