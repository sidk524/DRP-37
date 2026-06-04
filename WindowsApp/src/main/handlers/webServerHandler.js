const { ipcMain } = require("electron");

function registerWebServerHandlers() {
    ipcMain.handle("webserver:request", async (_event, { path, method = "GET", body, token, baseUrl }) => {
        const base = (baseUrl || "").trim().replace(/\/$/, "");
        if (!base) {
            return { ok: false, status: 0, data: { error: "Missing web server URL." } };
        }

        let response;
        try {
            response = await fetch(`${base}${path}`, {
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
                    error: `Could not reach web server at ${base}. Check that it is running and port 3000 is open.`,
                },
            };
        }

        const data = await response.json().catch(() => ({}));
        return { ok: response.ok, status: response.status, data };
    });
}

module.exports = { registerWebServerHandlers };
