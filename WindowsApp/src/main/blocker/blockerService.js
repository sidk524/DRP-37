const { ipcMain, BrowserWindow } = require("electron");
const extensionBridge = require("../extension/extensionBridge");

let expiryTimer = null;

let session = {
    active: false,
    sessionId: null,
    appLabels: [],
    domains: [],
    mode: "breathing",
    friction: {
        futureMessage: "",
        goals: [],
    },
    startedAt: null,
    endsAt: null,
    durationMinutes: 0,
};

let lastStop = null;

function sessionView() {
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

function extensionBlockState() {
    return {
        active: session.active,
        domains: session.domains,
        endsAt: session.endsAt,
        mode: session.mode,
        friction: session.friction,
    };
}

function normalizeFriction(friction = {}) {
    return {
        futureMessage: String(friction.futureMessage || "").trim(),
        goals: Array.isArray(friction.goals)
            ? friction.goals.map((goal) => String(goal).trim()).filter(Boolean)
            : [],
    };
}

function broadcast() {
    const view = sessionView();
    for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send("session:update", view);
    }
    extensionBridge.notifyStateChange();
}

function startSession({
    sessionId = null,
    appLabels = [],
    domains = [],
    mode = "breathing",
    friction = {},
    durationMinutes = 30,
    startedAt = null,
    endsAt = null,
} = {}) {
    const normalizedDomains = domains.map((domain) => String(domain).toLowerCase()).filter(Boolean);
    if (normalizedDomains.length === 0) {
        return { ok: false, error: "Pick at least one website to block." };
    }

    const resolvedMode = ["breathing", "reflect", "hard"].includes(mode) ? mode : "breathing";

    lastStop = null;
    const now = Date.now();
    const safeDurationMinutes = Math.max(1, durationMinutes);
    const safeStartedAt = Number.isFinite(startedAt) ? startedAt : now;
    const safeEndsAt = Number.isFinite(endsAt) ? endsAt : safeStartedAt + safeDurationMinutes * 60 * 1000;
    session = {
        active: true,
        sessionId,
        appLabels,
        domains: normalizedDomains,
        mode: resolvedMode,
        friction: normalizeFriction(friction),
        startedAt: safeStartedAt,
        endsAt: safeEndsAt,
        durationMinutes: safeDurationMinutes,
    };

    if (normalizedDomains.length > 0) {
        console.log(
            `[blocker] website blocking via browser extension (${normalizedDomains.length} domain(s))`
        );
    }

    if (expiryTimer) clearTimeout(expiryTimer);
    expiryTimer = setTimeout(() => stopSession("expired"), Math.max(0, session.endsAt - Date.now()));

    console.log(
        `[blocker] session started · ${session.mode} · ${durationMinutes}m · [${normalizedDomains.join(", ")}]`
    );
    broadcast();
    return { ok: true, session: sessionView() };
}

function updateSession({ mode, friction } = {}) {
    if (!session.active) {
        return { ok: false, error: "No active session to update." };
    }

    if (mode !== undefined) {
        session.mode = ["breathing", "reflect", "hard"].includes(mode) ? mode : "reflect";
    }

    if (friction !== undefined) {
        session.friction = normalizeFriction(friction);
    }

    console.log(`[blocker] session updated · ${session.mode}`);
    broadcast();
    return { ok: true, session: sessionView() };
}

function stopSession(reason = "manual") {
    const endedAt = Date.now();
    const startedAt = session.startedAt || endedAt;
    const plannedMs = Math.max(0, (session.durationMinutes || 0) * 60 * 1000);
    const elapsedMs = Math.max(0, endedAt - startedAt);
    const actualMs = plannedMs > 0 ? Math.min(elapsedMs, plannedMs) : elapsedMs;
    const blockedAppsCount = session.domains.length;

    lastStop = {
        reason,
        mode: session.mode,
        plannedMs,
        actualMs,
        blockedAppsCount,
        endedAt,
    };

    if (expiryTimer) clearTimeout(expiryTimer);
    expiryTimer = null;
    session = {
        active: false,
        sessionId: null,
        appLabels: [],
        domains: [],
        mode: "breathing",
        friction: {
            futureMessage: "",
            goals: [],
        },
        startedAt: null,
        endsAt: null,
        durationMinutes: 0,
    };
    console.log(`[blocker] session stopped (${reason})`);
    broadcast();
    return { ok: true, session: sessionView() };
}

function registerIpc() {
    ipcMain.handle("session:start", (_e, cfg) => startSession(cfg));
    ipcMain.handle("session:update", (_e, cfg) => updateSession(cfg));
    ipcMain.handle("session:get", () => sessionView());
    ipcMain.handle("extension:status", () => extensionBridge.status());

    ipcMain.handle("session:stop", () => {
        if (session.active && session.mode === "hard") {
            return { ok: false, error: "Hard sessions can't be ended early." };
        }
        return stopSession("manual");
    });
}

function start() {
    registerIpc();
    extensionBridge.setStateProvider(extensionBlockState);
    extensionBridge.start();
    console.log("[blocker] ready — waiting for a session to start.");
}

function stop() {
    if (expiryTimer) clearTimeout(expiryTimer);
    expiryTimer = null;
    extensionBridge.stop();
}

module.exports = { start, stop };
