const {
    createInactiveSession,
    createActiveSession,
    normalizeFriction,
    normalizeMode,
    sessionView,
} = require("./sessionState");

let extensionBridge = null;
let onSessionChange = null;
let expiryTimer = null;
let session = createInactiveSession();
let lastStop = null;

function safeClearExpiryTimer() {
    if (!expiryTimer) return;
    try {
        clearTimeout(expiryTimer);
    } catch (err) {
        console.warn(`[blocker] failed to clear session timer: ${err?.message || err}`);
    }
    expiryTimer = null;
}

function extensionBlockState() {
    return {
        active: session.active,
        domains: session.domains,
        endsAt: session.endsAt,
        mode: session.mode,
        friction: session.friction,
        blockGroupId: session.blockGroupId,
        blockGroupName: session.blockGroupName,
    };
}

function broadcast() {
    const view = sessionView(session, lastStop);
    try {
        if (onSessionChange) {
            onSessionChange(view);
        }
    } catch (err) {
        console.warn(`[blocker] failed to broadcast session update: ${err?.message || err}`);
    }
    try {
        if (extensionBridge) {
            extensionBridge.notifyStateChange();
        }
    } catch (err) {
        console.warn(`[blocker] failed to notify extension bridge: ${err?.message || err}`);
    }
}

function scheduleExpiry() {
    safeClearExpiryTimer();
    const endsAt = Number(session?.endsAt);
    if (!session.active || !Number.isFinite(endsAt)) return;

    const delay = Math.max(0, endsAt - Date.now());
    try {
        expiryTimer = setTimeout(() => stopSession("expired"), delay);
    } catch (err) {
        console.warn(`[blocker] failed to schedule session expiry: ${err?.message || err}`);
        expiryTimer = null;
    }
}

function startSession({
    sessionId = null,
    blockGroupId = null,
    blockGroupName = null,
    appLabels = [],
    domains = [],
    mode = "breathing",
    friction = {},
    durationMinutes = 30,
    startedAt = null,
    endsAt = null,
} = {}) {
    const created = createActiveSession({
        sessionId,
        blockGroupId,
        blockGroupName,
        appLabels,
        domains,
        mode,
        friction,
        durationMinutes,
        startedAt,
        endsAt,
    });
    if (!created.ok) return created;

    lastStop = null;
    session = created.session;

    if (session.domains.length > 0) {
        console.log(
            `[blocker] website blocking via browser extension (${session.domains.length} domain(s))`
        );
    }

    scheduleExpiry();

    console.log(
        `[blocker] session started · ${session.mode} · ${session.durationMinutes}m · [${session.domains.join(", ")}]`
    );
    broadcast();
    return { ok: true, session: sessionView(session, lastStop) };
}

function normalizeOptionalString(value) {
    const normalized = String(value ?? "").trim();
    return normalized || null;
}

function updateSession({ mode, friction, blockGroupId, blockGroupName } = {}) {
    if (!session.active) {
        return { ok: false, error: "No active session to update." };
    }

    if (mode !== undefined) {
        session.mode = normalizeMode(mode, "reflect");
    }

    if (friction !== undefined) {
        session.friction = normalizeFriction(friction);
    }

    if (blockGroupId !== undefined) {
        session.blockGroupId = normalizeOptionalString(blockGroupId);
    }

    if (blockGroupName !== undefined) {
        session.blockGroupName = normalizeOptionalString(blockGroupName);
    }

    console.log(`[blocker] session updated · ${session.mode}`);
    broadcast();
    return { ok: true, session: sessionView(session, lastStop) };
}

function stopSession(reason = "manual") {
    if (reason === "manual" && session.active && session.mode === "hard") {
        return { ok: false, error: "Hard sessions can't be ended early." };
    }

    const endedAt = Date.now();
    const startedAt = session.startedAt || endedAt;
    const plannedMs = Math.max(0, (session.durationMinutes || 0) * 60 * 1000);
    const elapsedMs = Math.max(0, endedAt - startedAt);
    const actualMs = plannedMs > 0 ? Math.min(elapsedMs, plannedMs) : elapsedMs;
    const blockedAppsCount = Math.max(1, (session.appLabels || []).length);

    lastStop = {
        reason,
        mode: session.mode,
        plannedMs,
        actualMs,
        blockedAppsCount,
        endedAt,
    };

    safeClearExpiryTimer();
    session = createInactiveSession();
    console.log(`[blocker] session stopped (${reason})`);
    broadcast();
    return { ok: true, session: sessionView(session, lastStop) };
}

function getSession() {
    return sessionView(session, lastStop);
}

function initialize({ onSessionChange: callback, extensionBridge: bridge }) {
    onSessionChange = callback;
    extensionBridge = bridge;
    extensionBridge.setStateProvider(extensionBlockState);
    extensionBridge.start();
    console.log("[blocker] ready — waiting for a session to start.");
}

function stop() {
    safeClearExpiryTimer();
    if (extensionBridge) {
        try {
            extensionBridge.stop();
        } catch (err) {
            console.warn(`[blocker] extension bridge stop failed: ${err?.message || err}`);
        }
    }
}

module.exports = {
    initialize,
    stop,
    startSession,
    updateSession,
    stopSession,
    getSession,
};
