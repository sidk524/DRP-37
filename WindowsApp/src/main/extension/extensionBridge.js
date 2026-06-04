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
let server = null;
let serverReady = false;

function setStateProvider(fn) {
    getState = fn;
}

function status() {
    return {
        bridgeUp: serverReady,
        clientsConnected: sseClients.size,
    };
}

function statePayload() {
    return {
        ...getState(),
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
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
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
    if (server) {
        server.close();
        server = null;
    }
    serverReady = false;
}

function notifyStateChange() {
    broadcast();
}

module.exports = {
    start,
    stop,
    setStateProvider,
    notifyStateChange,
    status,
    PORT,
    HOST,
};
