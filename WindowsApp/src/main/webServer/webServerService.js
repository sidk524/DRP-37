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
    return {
        leaderboard: data.leaderboard || [],
        focusPointsAvailable: data.focusPointsAvailable !== false,
    };
}

async function syncDefaultGroups({ scrollingWorst } = {}) {
    const normalizedScrollingWorst = normalizeNonEmptyStringArray(scrollingWorst);
    const data = await request("/api/groups/defaults/sync", {
        method: "POST",
        body: { scrollingWorst: normalizedScrollingWorst },
    });
    return data.groups || [];
}

async function loadOnboarding() {
    const data = await request("/api/onboarding");
    return data.onboarding || null;
}

function normalizeNonEmptyStringArray(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
}

function normalizeOnboardingResponses(responses) {
    const source = responses && typeof responses === "object" ? responses : {};
    return {
        ...source,
        doMoreOf: normalizeNonEmptyStringArray(source.doMoreOf),
        scrollingWorst: normalizeNonEmptyStringArray(source.scrollingWorst),
        futureMessage: String(source.futureMessage || "").trim(),
    };
}

async function saveOnboarding(responses) {
    const normalizedResponses = normalizeOnboardingResponses(responses);
    const data = await request("/api/onboarding", {
        method: "PUT",
        body: normalizedResponses,
    });
    return data.onboarding;
}

const MODE_POINTS_MULTIPLIER = {
    breathing: 1,
    reflect: 1.5,
    hard: 2.5,
};

const EXTRA_APP_MULTIPLIER = 0.25;

function normalizeSessionMode(mode) {
    return ["breathing", "reflect", "hard"].includes(mode) ? mode : "breathing";
}

function calculateFocusPoints(mode, actualMs, blockedAppsCount = 1) {
    const minutes = Math.max(0, actualMs) / 60000;
    const multiplier = MODE_POINTS_MULTIPLIER[normalizeSessionMode(mode)];
    const appsCount = Math.max(1, Math.round(blockedAppsCount) || 1);
    const appsMultiplier = 1 + (appsCount - 1) * EXTRA_APP_MULTIPLIER;
    return Math.max(0, Math.round(minutes * multiplier * appsMultiplier));
}

async function saveSessionPoints({
    mode,
    actualMs = 0,
    plannedMs = 0,
    blockedAppsCount = 1,
    endedAt,
}) {
    const data = await request("/api/focus-points", {
        method: "POST",
        body: {
            mode: normalizeSessionMode(mode),
            actualMs: Math.max(0, Math.round(actualMs)),
            plannedMs: Math.max(0, Math.round(plannedMs)),
            blockedAppsCount: Math.max(1, Math.round(blockedAppsCount) || 1),
            endedAt: endedAt || new Date().toISOString(),
        },
    });
    return data.record || null;
}

async function getUserTotalPoints() {
    const data = await request("/api/focus-points/total");
    return data.total || 0;
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
    saveSessionPoints,
    getUserTotalPoints,
};
