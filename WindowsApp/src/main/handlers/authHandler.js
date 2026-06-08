const { ipcMain } = require("electron");
const { IPC_CHANNELS } = require("../../shared/ipc/contracts");

let registered = false;

function normalizePayload(payload) {
    const safePayload = payload && typeof payload === "object" ? payload : {};
    return {
        email: String(safePayload.email || "").trim(),
        password: String(safePayload.password || ""),
        formEndpoint: String(safePayload.formEndpoint || "").trim().toLowerCase(),
    };
}

function registerAuthHandlers() {
    if (registered) return;
    ipcMain.removeHandler(IPC_CHANNELS.authSubmit);
    ipcMain.handle(IPC_CHANNELS.authSubmit, async (_event, payload) => {
        try {
            const { email, password, formEndpoint } = normalizePayload(payload);
            console.log("Auth form submit:", { formEndpoint, hasEmail: !!email, hasPassword: !!password });

            if (!email || !password) {
                return {
                    success: false,
                    message: "Email and password are required.",
                };
            }

            if (formEndpoint === "login") {
                // Login logic goes here
                return {
                    success: true,
                    message: "Login submitted successfully.",
                };
            }

            if (formEndpoint === "register") {
                // Register logic goes here
                return {
                    success: true,
                    message: "Register submitted successfully.",
                };
            }

            return {
                success: false,
                message: "Unknown auth action.",
            };
        } catch (err) {
            console.error("[auth] auth-submit handler failed:", err);
            return {
                success: false,
                message: "Unable to process authentication request.",
            };
        }
    });
    registered = true;
}

module.exports = {
    registerAuthHandlers,
};