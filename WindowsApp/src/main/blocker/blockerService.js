// The L1 "Mindful" blocker engine.
//
// Polls the foreground app once a second. When a blocked app is focused (and not
// in its grace window), it shows the breathing friction overlay. L1 never kills
// or hard-blocks — the overlay is always dismissible. "Continue" and "Not now"
// both just hide it and start a grace period so we don't nag every second.

const { ipcMain, globalShortcut } = require("electron");
const config = require("./config");
const { getForegroundApp } = require("./foregroundDetector");
const overlay = require("./overlayWindow");

let timer = null;
const graceUntil = new Map(); // appKey -> timestamp(ms) until which we won't re-prompt

function normalize(name) {
    return (name || "").toLowerCase().replace(/\.exe$/, "");
}

function isBlocked(name) {
    const n = normalize(name);
    if (!n) return false;
    return config.blocklist.some((b) => n.includes(b.toLowerCase()));
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

// Assemble the friction:show payload from current config.
function buildPayload(app, key, title) {
    return {
        app,
        key,
        title: title || "",
        mode: config.mode,
        selfMessage: config.selfMessage,
        breathSeconds: config.breathSeconds,
        breathCycles: config.breathCycles,
    };
}

function startGrace(key) {
    if (key) graceUntil.set(key, Date.now() + config.graceMs);
}

function registerIpc() {
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

    // Dev/test triggers: force each mode without a real blocked app.
    //   Ctrl+Shift+1 breathing · Ctrl+Shift+2 reflect · Ctrl+Shift+3 hard
    const testModes = { 1: "breathing", 2: "reflect", 3: "hard" };
    for (const [num, mode] of Object.entries(testModes)) {
        globalShortcut.register(`CommandOrControl+Shift+${num}`, () => {
            const payload = buildPayload("Instagram", "manual-test", "test trigger");
            payload.mode = mode;
            overlay.showFriction(payload);
        });
    }

    console.log("[blocker] L1 mindful blocker started. Blocklist:", config.blocklist.join(", "));
}

function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    globalShortcut.unregisterAll();
    overlay.destroy();
}

module.exports = { start, stop };
