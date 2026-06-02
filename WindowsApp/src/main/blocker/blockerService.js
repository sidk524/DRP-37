// The blocker engine — session-driven.
//
// No active session = nothing is blocked. "Start Session" (from BlockerSetup)
// activates blocking for a chosen set of apps, in a chosen mode, for a chosen
// duration. While active, the foreground app is polled once a second; a match
// shows the friction overlay in the session's mode. The session auto-ends when
// its duration elapses.

const { ipcMain, globalShortcut, BrowserWindow } = require("electron");
const config = require("./config");
const { getForegroundApp } = require("./foregroundDetector");
const overlay = require("./overlayWindow");

let timer = null;
let expiryTimer = null;
const graceUntil = new Map(); // appKey -> timestamp(ms) until which we won't re-prompt

// Active session state. blocklist = lowercase substring tokens to match against
// the foreground process name.
let session = {
    active: false,
    blocklist: [],
    appLabels: [],
    mode: "breathing",
    endsAt: null,
};

function normalize(name) {
    return (name || "").toLowerCase().replace(/\.exe$/, "");
}

function isBlocked(name) {
    const n = normalize(name);
    if (!n) return false;
    return session.blocklist.some((b) => n.includes(b.toLowerCase()));
}

function isOwnApp(name) {
    const n = normalize(name);
    return config.ownAppNames.some((b) => n.includes(b.toLowerCase()));
}

function inGrace(key) {
    const until = graceUntil.get(key);
    return until != null && Date.now() < until;
}

function prettyName(name) {
    const n = normalize(name);
    return n.charAt(0).toUpperCase() + n.slice(1);
}

async function tick() {
    if (!session.active) return;

    // End the session once its duration has elapsed.
    if (session.endsAt && Date.now() >= session.endsAt) {
        stopSession();
        return;
    }

    // If we're already showing the overlay, don't stack another check.
    if (overlay.isVisible()) return;

    const fg = await getForegroundApp();
    if (!fg || !fg.name) return;
    if (isOwnApp(fg.name)) return;
    if (!isBlocked(fg.name)) return;

    const key = normalize(fg.name);
    if (inGrace(key)) return;

    overlay.showFriction(buildPayload(prettyName(fg.name), key, fg.title));
}

// Assemble the friction:show payload — mode comes from the active session.
function buildPayload(app, key, title) {
    return {
        app,
        key,
        title: title || "",
        mode: session.mode,
        selfMessage: config.selfMessage,
        breathSeconds: config.breathSeconds,
        breathCycles: config.breathCycles,
    };
}

function startGrace(key) {
    if (key) graceUntil.set(key, Date.now() + config.graceMs);
}

// Serializable snapshot for the renderer.
function sessionView() {
    return {
        active: session.active,
        mode: session.mode,
        appLabels: session.appLabels,
        endsAt: session.endsAt,
        remainingMs: session.endsAt ? Math.max(0, session.endsAt - Date.now()) : null,
    };
}

function broadcast() {
    const view = sessionView();
    for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send("session:update", view);
    }
}

function startSession({ apps = [], appLabels = [], mode = "breathing", durationMinutes = 30 } = {}) {
    const blocklist = apps.map((a) => String(a).toLowerCase()).filter(Boolean);
    if (blocklist.length === 0) {
        return { ok: false, error: "Pick at least one app to block." };
    }

    graceUntil.clear();
    session = {
        active: true,
        blocklist,
        appLabels,
        mode: ["breathing", "reflect", "hard"].includes(mode) ? mode : "breathing",
        endsAt: Date.now() + Math.max(1, durationMinutes) * 60 * 1000,
    };

    if (expiryTimer) clearTimeout(expiryTimer);
    expiryTimer = setTimeout(() => stopSession(), session.endsAt - Date.now());

    console.log(
        `[blocker] session started · ${session.mode} · ${durationMinutes}m · [${blocklist.join(", ")}]`
    );
    broadcast();
    return { ok: true, session: sessionView() };
}

function stopSession() {
    if (expiryTimer) clearTimeout(expiryTimer);
    expiryTimer = null;
    session = { active: false, blocklist: [], appLabels: [], mode: "breathing", endsAt: null };
    graceUntil.clear();
    overlay.hideFriction();
    console.log("[blocker] session stopped");
    broadcast();
    return { ok: true, session: sessionView() };
}

function registerIpc() {
    // Session control (invoke -> returns ack).
    ipcMain.handle("session:start", (_e, cfg) => startSession(cfg));
    ipcMain.handle("session:stop", () => stopSession());
    ipcMain.handle("session:get", () => sessionView());

    // User chose to proceed to the app.
    ipcMain.on("friction:continue", (_e, { key } = {}) => {
        startGrace(key);
        overlay.hideFriction();
    });

    // User backed out. In breathing/reflect modes we start a short grace so we
    // don't immediately re-fire. In hard mode we deliberately DON'T — if the
    // blocked app stays focused the overlay returns, so there's no way through.
    ipcMain.on("friction:notNow", (_e, { key, mode } = {}) => {
        if (mode !== "hard") startGrace(key);
        overlay.hideFriction();
    });
}

function start() {
    overlay.preload();
    registerIpc();
    timer = setInterval(() => {
        tick().catch((err) => console.warn("[blocker] tick error:", err.message));
    }, config.pollIntervalMs);

    // Dev/test triggers: force each mode overlay without an active session.
    //   Ctrl+Shift+1 breathing · Ctrl+Shift+2 reflect · Ctrl+Shift+3 hard
    const testModes = { 1: "breathing", 2: "reflect", 3: "hard" };
    for (const [num, mode] of Object.entries(testModes)) {
        globalShortcut.register(`CommandOrControl+Shift+${num}`, () => {
            const payload = buildPayload("Instagram", "manual-test", "test trigger");
            payload.mode = mode;
            overlay.showFriction(payload);
        });
    }

    console.log("[blocker] ready — waiting for a session to start.");
}

function stop() {
    if (timer) clearInterval(timer);
    if (expiryTimer) clearTimeout(expiryTimer);
    timer = null;
    expiryTimer = null;
    globalShortcut.unregisterAll();
    overlay.destroy();
}

module.exports = { start, stop };
