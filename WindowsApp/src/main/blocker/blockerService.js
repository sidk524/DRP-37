// The blocker engine — session-driven.
//
// No active session = nothing is blocked. "Start Session" (from BlockerSetup)
// activates blocking for a chosen set of apps, in a chosen mode, for a chosen
// duration. While active, the foreground app is polled once a second; a match
// shows the friction overlay in the session's mode. The session auto-ends when
// its duration elapses.
//
// Modes differ in how a match is handled:
//   breathing / reflect — dismissible friction overlay (a nudge)
//   hard                — ABSOLUTE block: the offending process is terminated,
//                         then an informational overlay is shown. Relaunching
//                         just gets it killed again for the rest of the session.

const { ipcMain, globalShortcut, BrowserWindow } = require("electron");
const { exec } = require("child_process");
const config = require("./config");
const { getForegroundApp } = require("./foregroundDetector");
const overlay = require("./overlayWindow");
const hosts = require("./hostsBlocker");

// Processes we must never terminate, even if a blocklist token would match —
// killing these can crash the desktop session. A safety net around hard mode.
const PROTECTED_PROCESSES = [
    "system", "smss", "csrss", "wininit", "winlogon", "services", "lsass",
    "svchost", "explorer", "dwm", "taskmgr", "fontdrvhost", "ctfmon",
];

let timer = null;
let expiryTimer = null;
const graceUntil = new Map(); // appKey -> timestamp(ms) until which we won't re-prompt

// Active session state. blocklist = lowercase substring tokens to match against
// the foreground process name.
let session = {
    active: false,
    blocklist: [],
    appLabels: [],
    domains: [],
    mode: "breathing",
    startedAt: null,
    endsAt: null,
    durationMinutes: 0,
};

let lastStop = null;

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

function isProtected(name) {
    const n = normalize(name);
    return PROTECTED_PROCESSES.includes(n);
}

// Hard-mode enforcement: forcibly terminate the offending process by PID.
// `/T` also kills child processes; `/F` forces it. Best-effort — some elevated
// processes can't be killed without admin, which we log rather than throw.
function terminateProcess(pid, name) {
    if (!Number.isInteger(pid) || pid <= 0) return;
    if (isProtected(name)) {
        console.warn(`[blocker] refusing to terminate protected process: ${name}`);
        return;
    }
    exec(`taskkill /PID ${pid} /T /F`, (err, _stdout, stderr) => {
        if (err) {
            console.warn(
                `[blocker] could not terminate ${name} (pid ${pid}): ${(stderr || err.message).trim()}`
            );
        } else {
            console.log(`[blocker] hard-block terminated ${name} (pid ${pid})`);
        }
    });
}

async function tick() {
    if (!session.active) return;

    // End the session once its duration has elapsed.
    if (session.endsAt && Date.now() >= session.endsAt) {
        stopSession("expired");
        return;
    }

    // If we're already showing the overlay, don't stack another check.
    if (overlay.isVisible()) return;

    const fg = await getForegroundApp();
    if (!fg || !fg.name) return;
    if (isOwnApp(fg.name)) return;
    if (!isBlocked(fg.name)) return;

    const key = normalize(fg.name);

    // Hard mode is an absolute block: kill the process (no grace, no way
    // through), then show the overlay to explain why it just closed.
    if (session.mode === "hard") {
        terminateProcess(fg.processId, fg.name);
        overlay.showFriction(buildPayload(prettyName(fg.name), key, fg.title));
        return;
    }

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
        startedAt: session.startedAt,
        endsAt: session.endsAt,
        durationMinutes: session.durationMinutes,
        remainingMs: session.endsAt ? Math.max(0, session.endsAt - Date.now()) : null,
        lastStop,
    };
}

function broadcast() {
    const view = sessionView();
    for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send("session:update", view);
    }
}

function startSession({ apps = [], appLabels = [], domains = [], mode = "breathing", durationMinutes = 30 } = {}) {
    const blocklist = apps.map((a) => String(a).toLowerCase()).filter(Boolean);
    if (blocklist.length === 0) {
        return { ok: false, error: "Pick at least one app to block." };
    }

    const resolvedMode = ["breathing", "reflect", "hard"].includes(mode) ? mode : "breathing";

    graceUntil.clear();
    lastStop = null;
    const now = Date.now();
    const safeDurationMinutes = Math.max(1, durationMinutes);
    session = {
        active: true,
        blocklist,
        appLabels,
        domains,
        mode: resolvedMode,
        startedAt: now,
        endsAt: now + safeDurationMinutes * 60 * 1000,
        durationMinutes: safeDurationMinutes,
    };

    // Hard mode also blocks the websites at the network level (hosts file), so
    // it works for browser tabs, not just native apps. Non-fatal if it can't:
    // process-killing still applies and we warn the user (e.g. needs admin).
    let warning = null;
    if (resolvedMode === "hard" && domains.length > 0) {
        const res = hosts.blockDomains(domains);
        if (!res.ok) {
            warning = res.error;
            console.warn(`[blocker] website blocking failed: ${res.error}`);
        } else {
            console.log(`[blocker] blocked ${res.blocked.length} hostnames via hosts file`);
        }
    }

    if (expiryTimer) clearTimeout(expiryTimer);
    expiryTimer = setTimeout(() => stopSession("expired"), session.endsAt - Date.now());

    console.log(
        `[blocker] session started · ${session.mode} · ${durationMinutes}m · [${blocklist.join(", ")}]`
    );
    broadcast();
    return { ok: true, session: sessionView(), warning };
}

function stopSession(reason = "manual") {
    const endedAt = Date.now();
    const startedAt = session.startedAt || endedAt;
    const plannedMs = Math.max(0, (session.durationMinutes || 0) * 60 * 1000);
    const elapsedMs = Math.max(0, endedAt - startedAt);
    const actualMs = plannedMs > 0 ? Math.min(elapsedMs, plannedMs) : elapsedMs;
    const blockedAppsCount = session.appLabels.length;

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
        blocklist: [],
        appLabels: [],
        domains: [],
        mode: "breathing",
        startedAt: null,
        endsAt: null,
        durationMinutes: 0,
    };
    graceUntil.clear();
    overlay.hideFriction();
    hosts.unblockDomains(); // always lift any website block we put in place
    console.log(`[blocker] session stopped (${reason})`);
    broadcast();
    return { ok: true, session: sessionView() };
}

function registerIpc() {
    // Session control (invoke -> returns ack).
    ipcMain.handle("session:start", (_e, cfg) => startSession(cfg));
    ipcMain.handle("session:get", () => sessionView());

    // Manual stop. Hard sessions are a commitment — they can't be ended early;
    // only the expiry timer (or app quit) ends them. Breathing/reflect can stop.
    ipcMain.handle("session:stop", () => {
        if (session.active && session.mode === "hard") {
            return { ok: false, error: "Hard sessions can't be ended early." };
        }
        return stopSession("manual");
    });

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

    // Clear any leftover website block from a previous session that didn't shut
    // down cleanly (e.g. a crash), so the user is never stuck blocked at launch.
    hosts.unblockDomains();
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
    hosts.unblockDomains(); // never leave the hosts file blocked after we exit
}

module.exports = { start, stop };
