const { ipcMain, BrowserWindow } = require("electron");
const extensionBridge = require("../extension/extensionBridge");
const { IPC_CHANNELS, IPC_EVENTS } = require("../../shared/ipc/contracts");
const {
    createInactiveSession,
    createActiveSession,
    normalizeFriction,
    normalizeMode,
    sessionView,
} = require("./sessionState");

function createBlockerService({
    ipcMainApi = ipcMain,
    browserWindowApi = BrowserWindow,
    extensionBridgeApi = extensionBridge,
    now = () => Date.now(),
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
} = {}) {
    let expiryTimer = null;
    let session = createInactiveSession();
    let lastStop = null;
    let ipcRegistered = false;
    let started = false;

    function safeClearExpiryTimer() {
        if (!expiryTimer) return;
        try {
            clearTimeoutFn(expiryTimer);
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
        };
    }

    function broadcast() {
        const view = sessionView(session, lastStop);
        const windows = (() => {
            try {
                return browserWindowApi.getAllWindows();
            } catch (err) {
                console.warn(`[blocker] could not enumerate windows: ${err?.message || err}`);
                return [];
            }
        })();

        for (const win of windows) {
            try {
                if (!win || win.isDestroyed?.() || !win.webContents || win.webContents.isDestroyed?.()) continue;
                win.webContents.send(IPC_EVENTS.sessionUpdate, view);
            } catch (err) {
                console.warn(`[blocker] failed to broadcast session update: ${err?.message || err}`);
            }
        }

        try {
            extensionBridgeApi.notifyStateChange();
        } catch (err) {
            console.warn(`[blocker] failed to notify extension bridge: ${err?.message || err}`);
        }
    }

    function scheduleExpiry() {
        safeClearExpiryTimer();
        const endsAt = Number(session?.endsAt);
        if (!session.active || !Number.isFinite(endsAt)) return;

        const delay = Math.max(0, endsAt - now());
        try {
            expiryTimer = setTimeoutFn(() => stopSession("expired"), delay);
        } catch (err) {
            console.warn(`[blocker] failed to schedule session expiry: ${err?.message || err}`);
            expiryTimer = null;
        }
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
        const created = createActiveSession({
            sessionId,
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

    function updateSession({ mode, friction } = {}) {
        if (!session.active) {
            return { ok: false, error: "No active session to update." };
        }

        if (mode !== undefined) {
            session.mode = normalizeMode(mode, "reflect");
        }

        if (friction !== undefined) {
            session.friction = normalizeFriction(friction);
        }

        console.log(`[blocker] session updated · ${session.mode}`);
        broadcast();
        return { ok: true, session: sessionView(session, lastStop) };
    }

    function stopSession(reason = "manual") {
        const endedAt = now();
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

        safeClearExpiryTimer();
        session = createInactiveSession();
        console.log(`[blocker] session stopped (${reason})`);
        broadcast();
        return { ok: true, session: sessionView(session, lastStop) };
    }

    function safeHandler(fn, fallbackError = "Operation failed.") {
        return (...args) => {
            try {
                return fn(...args);
            } catch (err) {
                console.error(`[blocker] handler failure: ${err?.message || err}`);
                return { ok: false, error: fallbackError };
            }
        };
    }

    function registerIpc() {
        if (ipcRegistered) return;

        ipcMainApi.handle(IPC_CHANNELS.sessionStart, safeHandler((_e, cfg) => startSession(cfg), "Could not start focus session."));
        ipcMainApi.handle(IPC_CHANNELS.sessionUpdate, safeHandler((_e, cfg) => updateSession(cfg), "Could not update focus session."));
        ipcMainApi.handle(IPC_CHANNELS.sessionGet, safeHandler(() => sessionView(session, lastStop), "Could not get focus session."));
        ipcMainApi.handle(
            IPC_CHANNELS.extensionStatus,
            safeHandler(() => extensionBridgeApi.status(), "Could not read extension status.")
        );

        ipcMainApi.handle(IPC_CHANNELS.sessionStop, safeHandler(() => {
            if (session.active && session.mode === "hard") {
                return { ok: false, error: "Hard sessions can't be ended early." };
            }
            return stopSession("manual");
        }, "Could not stop focus session."));

        ipcRegistered = true;
    }

    function start() {
        if (started) return;
        started = true;
        registerIpc();
        try {
            extensionBridgeApi.setStateProvider(extensionBlockState);
        } catch (err) {
            console.warn(`[blocker] failed to set extension state provider: ${err?.message || err}`);
        }
        try {
            extensionBridgeApi.start();
        } catch (err) {
            console.warn(`[blocker] extension bridge start failed: ${err?.message || err}`);
        }
        console.log("[blocker] ready — waiting for a session to start.");
    }

    function stop() {
        safeClearExpiryTimer();
        try {
            extensionBridgeApi.stop();
        } catch (err) {
            console.warn(`[blocker] extension bridge stop failed: ${err?.message || err}`);
        }
        started = false;
    }

    return {
        start,
        stop,
        startSession,
        updateSession,
        stopSession,
        getSessionView: () => sessionView(session, lastStop),
    };
}

const blockerService = createBlockerService();

module.exports = {
    ...blockerService,
    createBlockerService,
};
