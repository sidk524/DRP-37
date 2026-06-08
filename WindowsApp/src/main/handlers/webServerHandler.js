const { ipcMain } = require("electron");
const { IPC_CHANNELS } = require("../../shared/ipc/contracts");

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
let registered = false;

function parseRequestPayload(payload) {
    const safePayload = payload && typeof payload === "object" ? payload : {};
    const path = String(safePayload.path || "").trim();
    const method = String(safePayload.method || "GET").toUpperCase();
    const baseUrl = String(safePayload.baseUrl || "").trim().replace(/\/$/, "");

    if (!baseUrl) {
        return { ok: false, error: "Missing web server URL." };
    }
    if (!path.startsWith("/")) {
        return { ok: false, error: "Invalid path. Must start with '/'." };
    }
    if (/\s/.test(path)) {
        return { ok: false, error: "Invalid path. Must not contain spaces." };
    }
    if (!ALLOWED_METHODS.has(method)) {
        return { ok: false, error: `Unsupported method '${method}'.` };
    }

    try {
        const parsedBase = new URL(baseUrl);
        if (!["http:", "https:"].includes(parsedBase.protocol)) {
            return { ok: false, error: "Invalid web server URL protocol." };
        }
    } catch {
        return { ok: false, error: "Invalid web server URL." };
    }

    return {
        ok: true,
        value: {
            path,
            method,
            body: safePayload.body,
            token: String(safePayload.token || ""),
            baseUrl,
        },
    };
}

function registerWebServerHandlers() {
    if (registered) return;
    ipcMain.removeHandler(IPC_CHANNELS.webServerRequest);
    ipcMain.handle(IPC_CHANNELS.webServerRequest, async (_event, payload) => {
        try {
            const parsed = parseRequestPayload(payload);
            if (!parsed.ok) {
                return { ok: false, status: 0, data: { error: parsed.error } };
            }
            const { path, method, body, token, baseUrl } = parsed.value;

            if (!token) {
                return { ok: false, status: 401, data: { error: "Missing access token." } };
            }

            let response;
            try {
                response = await fetch(`${baseUrl}${path}`, {
                    method,
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/json",
                        ...(body ? { "Content-Type": "application/json" } : {}),
                    },
                    body: body ? JSON.stringify(body) : undefined,
                });
            } catch {
                return {
                    ok: false,
                    status: 0,
                    data: {
                        error: `Could not reach web server at ${baseUrl}. Check that it is running and port 3000 is open.`,
                    },
                };
            }

            const data = await response.json().catch(() => ({}));
            return { ok: response.ok, status: response.status, data };
        } catch (err) {
            console.error("[web-server] IPC request failed:", err);
            return {
                ok: false,
                status: 0,
                data: {
                    error: "Web server request failed unexpectedly.",
                },
            };
        }
    });
    registered = true;
}

module.exports = { registerWebServerHandlers };
