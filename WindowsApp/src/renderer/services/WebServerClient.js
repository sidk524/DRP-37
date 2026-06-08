import { supabase } from "./SupabaseClient";
import { tetherApi, tetherWebServerRequest } from "./TetherClient";

const REQUEST_TIMEOUT_MS = 15000;

function configuredWebServerUrl() {
    return (import.meta.env.VITE_WEB_SERVER_URL || "").trim().replace(/\/$/, "");
}

function getApiBase() {
    if (tetherApi()?.webServerRequest) {
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

async function refreshAccessToken() {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
        throw new Error(`Failed to refresh Supabase session: ${error.message || "unknown error"}`);
    }
    const token = data?.session?.access_token;
    if (!token) {
        throw new Error("Session refresh returned no access token.");
    }
    return token;
}

function isInvalidBearerResponse(response, data) {
    return response?.status === 401 && /invalid bearer token/i.test(String(data?.error || ""));
}

export async function request(path, { method = "GET", body } = {}) {
    if (typeof path !== "string" || !path.startsWith("/")) {
        throw new Error("Invalid request path. Path must start with '/'.");
    }

    let token = await getAccessToken();
    const baseUrl = configuredWebServerUrl();

    if (tetherApi()?.webServerRequest) {
        if (!baseUrl) {
            throw new Error(
                "Missing VITE_WEB_SERVER_URL. Set it in WindowsApp/.env to your live web server."
            );
        }
        let result = await tetherWebServerRequest({
            path,
            method,
            body,
            token,
            baseUrl,
        });
        if (isInvalidBearerResponse(result, result?.data)) {
            token = await refreshAccessToken();
            result = await tetherWebServerRequest({
                path,
                method,
                body,
                token,
                baseUrl,
            });
        }
        if (!result || typeof result !== "object") {
            throw new Error("Web server bridge returned an invalid response.");
        }
        if (!result.ok) {
            throw new Error(result.data?.error || `Server returned HTTP ${result.status}.`);
        }
        return result.data;
    }

    const apiBase = getApiBase();
    const url = `${apiBase}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    async function performFetch(accessToken) {
        return fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
                ...(body ? { "Content-Type": "application/json" } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });
    }

    async function parseJsonSafe(response) {
        try {
            return await response.json();
        } catch {
            return {};
        }
    }

    let response;
    let data = {};
    try {
        response = await performFetch(token);
        data = await parseJsonSafe(response);
        if (isInvalidBearerResponse(response, data)) {
            token = await refreshAccessToken();
            response = await performFetch(token);
            data = await parseJsonSafe(response);
        }
    } catch {
        const target = apiBase || "the Vite dev proxy target";
        throw new Error(
            `Could not reach web server (${target}). Check that the server is running, port 3000 is open in the security group, and VITE_WEB_SERVER_URL is correct.`
        );
    } finally {
        clearTimeout(timeout);
    }

    if (!response.ok) {
        throw new Error(data?.error || `Server returned HTTP ${response.status}.`);
    }
    return data;
}
