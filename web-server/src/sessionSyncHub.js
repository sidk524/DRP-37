const { WebSocketServer } = require("ws");

const SYNC_PATH = "/api/session/sync";
const HEARTBEAT_INTERVAL_MS = 30_000;
const UNAUTHORIZED_CLOSE_CODE = 4401;

/**
 * Real-time fan-out hub for block sessions.
 *
 * The hub is deliberately transport-only: it knows nothing about Supabase or
 * Express. Authentication and snapshot loading are injected so the REST layer
 * stays the single source of truth for session shape and validation.
 *
 * @param {object} deps
 * @param {(token: string) => Promise<string|null>} deps.verifyToken
 *        Resolves a bearer token to a user id (or null when invalid).
 * @param {(userId: string) => Promise<object|null>} deps.getSnapshot
 *        Returns the current session payload for a user (or null when none).
 * @param {string} [deps.path] WebSocket upgrade path.
 */
function createSessionSyncHub({ verifyToken, getSnapshot, path = SYNC_PATH }) {
    if (typeof verifyToken !== "function") {
        throw new TypeError("verifyToken must be a function");
    }
    if (typeof getSnapshot !== "function") {
        throw new TypeError("getSnapshot must be a function");
    }

    /** @type {Map<string, Set<object>>} userId -> set of connections */
    const connectionsByUser = new Map();
    let wss = null;
    let heartbeatTimer = null;
    let revision = 0;

    function addConnection(userId, conn) {
        let set = connectionsByUser.get(userId);
        if (!set) {
            set = new Set();
            connectionsByUser.set(userId, set);
        }
        set.add(conn);
    }

    function removeConnection(userId, conn) {
        const set = connectionsByUser.get(userId);
        if (!set) return;
        set.delete(conn);
        if (set.size === 0) connectionsByUser.delete(userId);
    }

    function sendTo(conn, payload) {
        if (conn.ws.readyState !== conn.ws.OPEN) return;
        try {
            conn.ws.send(JSON.stringify(payload));
        } catch (err) {
            console.warn(`[session-sync] failed to send: ${err?.message || err}`);
        }
    }

    function extractToken(req) {
        const protocolHeader = req.headers["sec-websocket-protocol"];
        if (protocolHeader) {
            // Clients may send "bearer, <token>" as two subprotocol tokens.
            const parts = String(protocolHeader).split(",").map((part) => part.trim());
            const bearerIndex = parts.findIndex((part) => part.toLowerCase() === "bearer");
            if (bearerIndex !== -1 && parts[bearerIndex + 1]) return parts[bearerIndex + 1];
            if (parts.length === 1 && parts[0]) return parts[0];
        }
        try {
            const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
            const queryToken = url.searchParams.get("access_token");
            if (queryToken) return queryToken;
        } catch {
            /* ignore malformed URL */
        }
        return null;
    }

    function handleMessage(conn, raw) {
        let message;
        try {
            message = JSON.parse(raw.toString());
        } catch {
            return;
        }
        if (!message || typeof message !== "object") return;

        switch (message.type) {
            case "hello":
                if (typeof message.deviceId === "string") conn.deviceId = message.deviceId;
                if (typeof message.platform === "string") conn.platform = message.platform;
                break;
            case "ping":
                sendTo(conn, { type: "pong" });
                break;
            default:
                break;
        }
    }

    async function handleConnection(ws, req) {
        const token = extractToken(req);
        let userId = null;
        try {
            userId = token ? await verifyToken(token) : null;
        } catch {
            userId = null;
        }

        if (!userId) {
            try {
                ws.close(UNAUTHORIZED_CLOSE_CODE, "Unauthorized");
            } catch {
                ws.terminate();
            }
            return;
        }

        const conn = { ws, userId, deviceId: null, platform: null, isAlive: true };
        addConnection(userId, conn);

        ws.on("pong", () => {
            conn.isAlive = true;
        });
        ws.on("message", (raw) => handleMessage(conn, raw));
        ws.on("close", () => removeConnection(userId, conn));
        ws.on("error", () => removeConnection(userId, conn));

        try {
            const session = await getSnapshot(userId);
            sendTo(conn, {
                type: "session.sync",
                revision,
                originDeviceId: null,
                session: session || null,
            });
        } catch (err) {
            console.warn(`[session-sync] snapshot failed: ${err?.message || err}`);
        }
    }

    /**
     * Push a session update to every connected device for a user, optionally
     * skipping the device that originated the change (echo suppression).
     */
    function broadcastSession(userId, session, { excludeDeviceId = null } = {}) {
        revision += 1;
        const payload = {
            type: "session.sync",
            revision,
            originDeviceId: excludeDeviceId || null,
            session: session || null,
        };
        const set = connectionsByUser.get(userId);
        if (!set) return;
        for (const conn of set) {
            if (excludeDeviceId && conn.deviceId && conn.deviceId === excludeDeviceId) continue;
            sendTo(conn, payload);
        }
    }

    function getConnectedCount(userId) {
        return connectionsByUser.get(userId)?.size || 0;
    }

    function startHeartbeat() {
        stopHeartbeat();
        heartbeatTimer = setInterval(() => {
            for (const set of connectionsByUser.values()) {
                for (const conn of set) {
                    if (!conn.isAlive) {
                        conn.ws.terminate();
                        continue;
                    }
                    conn.isAlive = false;
                    try {
                        conn.ws.ping();
                    } catch {
                        conn.ws.terminate();
                    }
                }
            }
        }, HEARTBEAT_INTERVAL_MS);
        if (typeof heartbeatTimer.unref === "function") heartbeatTimer.unref();
    }

    function stopHeartbeat() {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    }

    /** Attach to an existing HTTP server, scoped to {@link path}. */
    function attach(server) {
        if (wss) return;
        wss = new WebSocketServer({ noServer: true });
        server.on("upgrade", (req, socket, head) => {
            let pathname;
            try {
                pathname = new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname;
            } catch {
                socket.destroy();
                return;
            }
            if (pathname !== path) return;
            wss.handleUpgrade(req, socket, head, (ws) => handleConnection(ws, req));
        });
        startHeartbeat();
        console.log(`[session-sync] websocket hub ready at ${path}`);
    }

    function close() {
        stopHeartbeat();
        for (const set of connectionsByUser.values()) {
            for (const conn of set) {
                try {
                    conn.ws.terminate();
                } catch {
                    /* ignore */
                }
            }
        }
        connectionsByUser.clear();
        if (wss) {
            wss.close();
            wss = null;
        }
    }

    return {
        attach,
        close,
        broadcastSession,
        getConnectedCount,
        // Exposed for tests.
        handleConnection,
        SYNC_PATH: path,
    };
}

module.exports = { createSessionSyncHub, SYNC_PATH };
