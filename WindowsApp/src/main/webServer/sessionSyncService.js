const WebSocket = require("ws");
const authService = require("../auth/authService");
const { getDeviceId } = require("./deviceIdentity");

const SYNC_PATH = "/api/session/sync";
const INITIAL_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

let socket = null;
let onSync = null;
let shouldRun = false;
let reconnectTimer = null;
let reconnectDelay = INITIAL_RECONNECT_MS;

function wsBaseUrl() {
    const base = (process.env.VITE_WEB_SERVER_URL || "").trim().replace(/\/$/, "");
    if (!base) return "";
    if (/^https:/i.test(base)) return base.replace(/^https:/i, "wss:");
    if (/^http:/i.test(base)) return base.replace(/^http:/i, "ws:");
    return `ws://${base}`;
}

function clearReconnectTimer() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}

function scheduleReconnect() {
    if (!shouldRun) return;
    clearReconnectTimer();
    const delay = reconnectDelay;
    reconnectDelay = Math.min(MAX_RECONNECT_MS, reconnectDelay * 2);
    reconnectTimer = setTimeout(connect, delay);
}

function closeSocket() {
    if (!socket) return;
    try {
        socket.removeAllListeners();
        socket.terminate();
    } catch {
        /* ignore */
    }
    socket = null;
}

async function connect() {
    if (!shouldRun) return;
    clearReconnectTimer();

    const base = wsBaseUrl();
    if (!base) return; // No server configured; stay idle.

    let token = null;
    try {
        token = (await authService.getSession())?.access_token || null;
    } catch {
        token = null;
    }
    if (!token) {
        // Logged out (or token unavailable) — retry later in case auth lands.
        scheduleReconnect();
        return;
    }

    const url = `${base}${SYNC_PATH}?access_token=${encodeURIComponent(token)}`;
    try {
        socket = new WebSocket(url);
    } catch (err) {
        console.warn(`[session-sync] connect failed: ${err?.message || err}`);
        scheduleReconnect();
        return;
    }

    socket.on("open", () => {
        reconnectDelay = INITIAL_RECONNECT_MS;
        try {
            socket.send(JSON.stringify({ type: "hello", deviceId: getDeviceId(), platform: "windows" }));
        } catch {
            /* ignore */
        }
    });

    socket.on("message", (raw) => {
        let message;
        try {
            message = JSON.parse(raw.toString());
        } catch {
            return;
        }
        if (typeof message?.type === "string" && typeof onSync === "function") {
            try {
                onSync(message);
            } catch (err) {
                console.warn(`[session-sync] handler error: ${err?.message || err}`);
            }
        }
    });

    socket.on("close", () => {
        socket = null;
        scheduleReconnect();
    });

    socket.on("error", (err) => {
        console.warn(`[session-sync] socket error: ${err?.message || err}`);
        // 'close' fires after 'error' and drives the reconnect.
    });
}

function initialize({ onSync: handler } = {}) {
    onSync = typeof handler === "function" ? handler : null;
}

function start() {
    shouldRun = true;
    reconnectDelay = INITIAL_RECONNECT_MS;
    closeSocket();
    connect();
}

function stop() {
    shouldRun = false;
    clearReconnectTimer();
    closeSocket();
}

module.exports = { initialize, start, stop };
