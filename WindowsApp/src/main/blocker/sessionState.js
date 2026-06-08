const SESSION_MODES = new Set(["breathing", "reflect", "hard"]);

const EMPTY_FRICTION = Object.freeze({
    futureMessage: "",
    goals: [],
});

function createInactiveSession() {
    return {
        active: false,
        sessionId: null,
        appLabels: [],
        domains: [],
        mode: "breathing",
        friction: { ...EMPTY_FRICTION },
        startedAt: null,
        endsAt: null,
        durationMinutes: 0,
    };
}

function normalizeStringArray(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeDomains(domains) {
    return normalizeStringArray(domains).map((domain) => domain.toLowerCase());
}

function normalizeFriction(friction = {}) {
    return {
        futureMessage: String(friction.futureMessage || "").trim(),
        goals: normalizeStringArray(friction.goals),
    };
}

function normalizeMode(mode, fallback = "breathing") {
    return SESSION_MODES.has(mode) ? mode : fallback;
}

function normalizeDurationMinutes(durationMinutes) {
    return Math.max(1, Number.isFinite(durationMinutes) ? Math.floor(durationMinutes) : 30);
}

function createActiveSession(config = {}, now = Date.now()) {
    const domains = normalizeDomains(config.domains);
    if (domains.length === 0) {
        return { ok: false, error: "Pick at least one website to block." };
    }

    const safeDurationMinutes = normalizeDurationMinutes(config.durationMinutes);
    const safeStartedAt = Number.isFinite(config.startedAt) ? config.startedAt : now;
    const safeEndsAt = Number.isFinite(config.endsAt)
        ? config.endsAt
        : safeStartedAt + safeDurationMinutes * 60 * 1000;
    const normalizedEndsAt = Math.max(safeStartedAt, safeEndsAt);

    return {
        ok: true,
        session: {
            active: true,
            sessionId: config.sessionId ?? null,
            appLabels: normalizeStringArray(config.appLabels),
            domains,
            mode: normalizeMode(config.mode, "breathing"),
            friction: normalizeFriction(config.friction),
            startedAt: safeStartedAt,
            endsAt: normalizedEndsAt,
            durationMinutes: safeDurationMinutes,
        },
    };
}

function sessionView(session, lastStop) {
    return {
        active: session.active,
        sessionId: session.sessionId,
        mode: session.mode,
        appLabels: session.appLabels,
        domains: session.domains,
        friction: session.friction,
        startedAt: session.startedAt,
        endsAt: session.endsAt,
        durationMinutes: session.durationMinutes,
        remainingMs: session.endsAt ? Math.max(0, session.endsAt - Date.now()) : null,
        lastStop,
    };
}

module.exports = {
    SESSION_MODES,
    createInactiveSession,
    createActiveSession,
    normalizeFriction,
    normalizeMode,
    sessionView,
};
