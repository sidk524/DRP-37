import { supabase } from "./SupabaseClient";

function configuredWebServerUrl() {
    return (import.meta.env.VITE_WEB_SERVER_URL || "").trim().replace(/\/$/, "");
}

function getApiBase() {
    if (typeof window !== "undefined" && window.tether?.webServerRequest) {
        return null;
    }
    if (import.meta.env.DEV) {
        return "";
    }
    const configured = configuredWebServerUrl();
    if (!configured) {
        throw new Error(
            "Missing VITE_WEB_SERVER_URL. Set it to your live web server, for example http://13.60.4.193:3000."
        );
    }
    return configured;
}

async function getAccessToken() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const token = data?.session?.access_token;
    if (!token) throw new Error("No active Supabase session.");
    return token;
}

export async function request(path, { method = "GET", body } = {}) {
    const token = await getAccessToken();
    const baseUrl = configuredWebServerUrl();

    if (typeof window !== "undefined" && window.tether?.webServerRequest) {
        if (!baseUrl) {
            throw new Error(
                "Missing VITE_WEB_SERVER_URL. Set it in WindowsApp/.env to your live web server."
            );
        }
        const result = await window.tether.webServerRequest({
            path,
            method,
            body,
            token,
            baseUrl,
        });
        if (!result.ok) {
            throw new Error(result.data?.error || `Server returned HTTP ${result.status}.`);
        }
        return result.data;
    }

    const apiBase = getApiBase();
    const url = `${apiBase}${path}`;

    let response;
    try {
        response = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                ...(body ? { "Content-Type": "application/json" } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch {
        const target = apiBase || "the Vite dev proxy target";
        throw new Error(
            `Could not reach web server (${target}). Check that the server is running, port 3000 is open in the security group, and VITE_WEB_SERVER_URL is correct.`
        );
    }

    let data = {};
    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(data?.error || `Server returned HTTP ${response.status}.`);
    }
    return data;
}
