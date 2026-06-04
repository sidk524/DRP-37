const { ipcMain } = require("electron");
const { getOAuthRedirectUrl } = require("./oauthConfig");
const { startBrowserOAuth } = require("./oauthBrowser");

function registerOAuthIpc() {
    ipcMain.handle("oauth:redirect-url", () => getOAuthRedirectUrl());
    ipcMain.handle("oauth:login", (_e, authUrl) => startBrowserOAuth(authUrl));
}

module.exports = { registerOAuthIpc };
