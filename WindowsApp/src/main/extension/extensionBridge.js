const http = require("http");

const PORT = 17894;
const HOST = "127.0.0.1";

let getState = () => ({
    active: false,
    domains: [],
    endsAt: null,
    mode: "breathing",
});

const sseClients = new Set();
const accountabilityClients = new Set();
let server = null;
let serverReady = false;
let reportAttempt = null;
let sendMessage = null;

function setStateProvider(fn) {
    if (typeof fn !== "function") {
        throw new TypeError("State provider must be a function.");
    }
    getState = fn;
}

function setAttemptReporter(fn) {
    reportAttempt = typeof fn === "function" ? fn : null;
}

function setMessageSender(fn) {
    sendMessage = typeof fn === "function" ? fn : null;
}

function status() {
    return {
        bridgeUp: serverReady,
        clientsConnected: sseClients.size,
    };
}

function statePayload() {
    let state;
    try {
        state = getState();
    } catch (err) {
        console.warn(`[extension-bridge] state provider failed: ${err?.message || err}`);
        state = { active: false, domains: [], endsAt: null, mode: "breathing", friction: { futureMessage: "", goals: [] } };
    }
    return {
        ...(state && typeof state === "object" ? state : {}),
        extensionConnected: sseClients.size > 0,
    };
}

function broadcast() {
    const payload = `data: ${JSON.stringify(statePayload())}\n\n`;
    for (const res of sseClients) {
        try {
            res.write(payload);
        } catch {
            sseClients.delete(res);
        }
    }
}

function setCors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function handleRequest(req, res) {
    setCors(res);
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url || "/", `http://${HOST}`);

    if (req.method === "GET" && url.pathname === "/api/block-state") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(statePayload()));
        return;
    }

    if (req.method === "GET" && url.pathname === "/api/block-state/stream") {
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        });
        res.write(`data: ${JSON.stringify(statePayload())}\n\n`);
        sseClients.add(res);
        req.on("close", () => sseClients.delete(res));
        return;
    }

    if (req.method === "GET" && url.pathname === "/api/accountability/stream") {
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        });
        accountabilityClients.add(res);
        req.on("close", () => accountabilityClients.delete(res));
        return;
    }

    if (req.method === "POST" && url.pathname === "/api/accountability/attempts") {
        let raw = "";
        req.on("data", (chunk) => { raw += chunk; });
        req.on("end", async () => {
            try {
                if (!reportAttempt) throw new Error("Attempt reporter unavailable");
                const result = await reportAttempt(JSON.parse(raw || "{}"));
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result || {}));
            } catch (error) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: error?.message || "Attempt report failed" }));
            }
        });
        return;
    }

    const messageMatch = url.pathname.match(/^\/api\/accountability\/attempts\/([^/]+)\/messages$/);
    if (req.method === "POST" && messageMatch) {
        let raw = "";
        req.on("data", (chunk) => { raw += chunk; });
        req.on("end", async () => {
            try {
                if (!sendMessage) throw new Error("Message sender unavailable");
                const result = await sendMessage(decodeURIComponent(messageMatch[1]), JSON.parse(raw || "{}"));
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result || {}));
            } catch (error) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: error?.message || "Message failed" }));
            }
        });
        return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, service: "tether-extension-bridge", ...status() }));
        return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
}

function start() {
    if (server) return;
    server = http.createServer(handleRequest);
    server.on("close", () => {
        serverReady = false;
    });
    server.listen(PORT, HOST, () => {
        serverReady = true;
        console.log(`[extension-bridge] http://${HOST}:${PORT}`);
    });
    server.on("error", (err) => {
        serverReady = false;
        console.warn(`[extension-bridge] server error: ${err.message}`);
    });
}

function stop() {
    for (const res of sseClients) {
        try {
            res.end();
        } catch {
            /* ignore */
        }
    }
    sseClients.clear();
    accountabilityClients.clear();
    if (server) {
        server.close((err) => {
            if (err) {
                console.warn(`[extension-bridge] close failed: ${err?.message || err}`);
            }
        });
        server = null;
    }
    serverReady = false;
}

function notifyStateChange() {
    broadcast();
}

function notifyAccountability(event) {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of accountabilityClients) {
        try { res.write(payload); } catch { accountabilityClients.delete(res); }
    }
}

module.exports = {
    start,
    stop,
    setStateProvider,
    setAttemptReporter,
    setMessageSender,
    notifyStateChange,
    notifyAccountability,
    status,
    PORT,
    HOST,
};
