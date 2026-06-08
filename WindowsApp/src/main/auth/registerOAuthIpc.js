const { ipcMain } = require("electron");
const { getOAuthRedirectUrl } = require("./oauthConfig");
const { startBrowserOAuth } = require("./oauthBrowser");
const { IPC_CHANNELS } = require("../../shared/ipc/contracts");

let registered = false;

function normalizeAuthUrl(authUrl) {
    const value = String(authUrl || "").trim();
    if (!value) throw new Error("Missing OAuth URL.");
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") {
        throw new Error("Invalid OAuth URL protocol.");
    }
    return parsed.toString();
}

function registerOAuthIpc() {
    if (registered) return;
    ipcMain.removeHandler(IPC_CHANNELS.oauthRedirectUrl);
    ipcMain.removeHandler(IPC_CHANNELS.oauthLogin);

    ipcMain.handle(IPC_CHANNELS.oauthRedirectUrl, () => getOAuthRedirectUrl());
    ipcMain.handle(IPC_CHANNELS.oauthLogin, async (_e, authUrl) => {
        const safeAuthUrl = normalizeAuthUrl(authUrl);
        return startBrowserOAuth(safeAuthUrl);
    });

    registered = true;
}

module.exports = { registerOAuthIpc };
