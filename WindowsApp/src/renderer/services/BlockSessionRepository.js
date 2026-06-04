import { supabase } from "./SupabaseClient";

const webServerUrl = import.meta.env.VITE_WEB_SERVER_URL;

function requireWebServerUrl() {
    const baseUrl = (webServerUrl || "").trim().replace(/\/$/, "");
    if (!baseUrl) throw new Error("Missing VITE_WEB_SERVER_URL.");
    return baseUrl;
}

async function getAccessToken() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const token = data?.session?.access_token;
    if (!token) throw new Error("No active Supabase session.");
    return token;
}

async function request(path, { method = "GET", body } = {}) {
    const token = await getAccessToken();
    const response = await fetch(`${requireWebServerUrl()}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data?.error || `Server returned HTTP ${response.status}.`);
    }
    return data;
}

export async function loadActiveSession() {
    const data = await request("/api/session/current");
    return data.session || null;
}

export async function createSession({ domainsBlocked, totalDurationSeconds }) {
    const data = await request("/api/session/current", {
        method: "PUT",
        body: {
            active: true,
            domainsBlocked,
            totalDurationSeconds,
        },
    });
    return data.session;
}

export async function endSession(sessionId) {
    const data = await request("/api/session/current", {
        method: "PUT",
        body: {
            active: false,
            sessionId,
        },
    });
    return data.sessions || [];
}
