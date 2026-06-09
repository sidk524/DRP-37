const authService = require("../auth/authService");

function getBaseUrl() {
    return (process.env.VITE_WEB_SERVER_URL || "").trim().replace(/\/$/, "");
}

async function requireAccessToken() {
    const session = await authService.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("No active Supabase session.");
    return token;
}

async function request(path, { method = "GET", body } = {}) {
    const base = getBaseUrl();
    if (!base) {
        throw new Error(
            "Missing VITE_WEB_SERVER_URL. Set it in WindowsApp/.env to your live web server."
        );
    }

    const token = await requireAccessToken();

    let response;
    try {
        response = await fetch(`${base}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                ...(body ? { "Content-Type": "application/json" } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch {
        throw new Error(
            `Could not reach web server at ${base}. Check that it is running and port 3000 is open.`
        );
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data?.error || `Server returned HTTP ${response.status}.`);
    }
    return data;
}

async function getCurrentSession() {
    const data = await request("/api/session/current");
    return data.session || null;
}

async function createSession({ domainsBlocked, totalDurationSeconds }) {
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

async function endSession(sessionId) {
    const data = await request("/api/session/current", {
        method: "PUT",
        body: {
            active: false,
            sessionId,
        },
    });
    return data.sessions || [];
}

async function listGroups() {
    const data = await request("/api/groups");
    return data.groups || [];
}

async function createGroup({ name }) {
    const data = await request("/api/groups", {
        method: "POST",
        body: { name },
    });
    return data.group;
}

async function joinGroup({ inviteCode }) {
    const data = await request("/api/groups/join", {
        method: "POST",
        body: { inviteCode },
    });
    return data.group;
}

async function getGroupLeaderboard(groupId) {
    const data = await request(`/api/groups/${encodeURIComponent(groupId)}/leaderboard`);
    return data.leaderboard || [];
}

async function syncDefaultGroups({ scrollingWorst }) {
    const data = await request("/api/groups/defaults/sync", {
        method: "POST",
        body: { scrollingWorst },
    });
    return data.groups || [];
}

async function loadOnboarding() {
    const data = await request("/api/onboarding");
    return data.onboarding || null;
}

async function saveOnboarding(responses) {
    const data = await request("/api/onboarding", {
        method: "PUT",
        body: responses,
    });
    return data.onboarding;
}

module.exports = {
    getCurrentSession,
    createSession,
    endSession,
    listGroups,
    createGroup,
    joinGroup,
    getGroupLeaderboard,
    syncDefaultGroups,
    loadOnboarding,
    saveOnboarding,
};
