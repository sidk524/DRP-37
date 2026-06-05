import { request } from "./WebServerClient";

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
