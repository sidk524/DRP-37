import { createClient } from '@supabase/supabase-js';
import { getTetherOAuthRedirectUrl, tetherOAuthLogin, tetherApi } from "./TetherClient";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
        'Missing Supabase credentials. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env file'
    );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,
    },
});

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
    if (!tetherApi()?.oauthLogin || !tetherApi()?.getOAuthRedirectUrl) {
        throw new Error('Google sign-in is only available in the desktop app.');
    }

    const redirectTo = await getTetherOAuthRedirectUrl();

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            skipBrowserRedirect: true,
            redirectTo,
        },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Could not start Google sign-in.');

    const callback = await tetherOAuthLogin(data.url);

    if (callback?.code) {
        const { data: sessionData, error: sessionError } =
            await supabase.auth.exchangeCodeForSession(callback.code);
        if (sessionError) throw sessionError;
        return sessionData;
    }

    if (callback?.access_token) {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: callback.access_token,
            refresh_token: callback.refresh_token,
        });
        if (sessionError) throw sessionError;
        return sessionData;
    }

    throw new Error('Google sign-in was cancelled.');
}

export async function getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const session = data?.session ?? null;
    return session;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

export async function getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const user = data?.user ?? null;
    return user;
}

function toStringArray(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function normalizeStrictness(strictness) {
    return ["gentle", "moderate", "hard"].includes(strictness) ? strictness : "moderate";
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

export async function loadOnboarding(userId) {
    const { data, error } = await supabase
        .from('onboarding')
        .select('do_more_of,scrolling_worst,future_message,strictness')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const strictness = normalizeStrictness(data.strictness);
    return {
        doMoreOf: toStringArray(data.do_more_of),
        scrollingWorst: toStringArray(data.scrolling_worst),
        futureMessage: data.future_message || '',
        strictness,
    };
}

export async function saveOnboarding(userId, responses) {
    if (!userId) throw new Error("Missing user id.");
    const safeResponses = responses && typeof responses === "object" ? responses : {};

    const { data, error } = await supabase
        .from('onboarding')
        .upsert({
            user_id: userId,
            do_more_of: toStringArray(safeResponses.doMoreOf),
            scrolling_worst: toStringArray(safeResponses.scrollingWorst),
            future_message: String(safeResponses.futureMessage || ''),
            strictness: normalizeStrictness(safeResponses.strictness),
        }, { onConflict: 'user_id' });
    if (error) throw error;
    return data;
}

const MODE_POINTS_MULTIPLIER = {
    breathing: 1,
    reflect: 1.5,
    hard: 2.5,
};

const EXTRA_APP_MULTIPLIER = 0.25;

function isMissingTableError(error) {
    return error?.code === "PGRST205" || /Could not find the table/i.test(error?.message || "");
}

function calculateFocusPoints(mode, actualMs, blockedAppsCount = 1) {
    const minutes = Math.max(0, actualMs) / 60000;
    const multiplier = MODE_POINTS_MULTIPLIER[mode] || MODE_POINTS_MULTIPLIER.breathing;
    const appsCount = Math.max(1, Math.round(blockedAppsCount) || 1);
    const appsMultiplier = 1 + (appsCount - 1) * EXTRA_APP_MULTIPLIER;
    return Math.max(0, Math.round(minutes * multiplier * appsMultiplier));
}

export async function saveSessionPoints({ userId, mode, actualMs = 0, plannedMs = 0, blockedAppsCount = 1, endedAt }) {
    const points = calculateFocusPoints(mode, actualMs, blockedAppsCount);
    const safeBlockedAppsCount = Math.max(1, Math.round(blockedAppsCount) || 1);

    const { data, error } = await supabase
        .from("focus_session_points")
        .insert({
            user_id: userId,
            mode,
            actual_ms: Math.max(0, Math.round(actualMs)),
            planned_ms: Math.max(0, Math.round(plannedMs)),
            blocked_apps_count: safeBlockedAppsCount,
            points,
            ended_at: endedAt || new Date().toISOString(),
        })
        .select()
        .single();

    if (isMissingTableError(error)) return null;
    if (error) throw error;
    return data;
}

export async function getUserTotalPoints(userId) {
    const { data, error } = await supabase
        .from("focus_session_points")
        .select("points")
        .eq("user_id", userId);

    if (isMissingTableError(error)) return 0;
    if (error) throw error;
    return (data || []).reduce((sum, row) => sum + (row.points || 0), 0);
}
