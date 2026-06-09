const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { app, BrowserWindow, ipcMain } = require("electron");
const CHANNELS = require("./ipc/channels");
const authService = require("./auth/authService");
const webServerService = require("./webServer/webServerService");
const blockerService = require("./blocker/blockerService");
const extensionBridge = require("./extension/extensionBridge");

const isDev = process.env.NODE_ENV === "development";

let mainWindow = null;

process.on("uncaughtException", (error) => {
    console.error("[main] uncaught exception:", error);
});

process.on("unhandledRejection", (reason) => {
    console.error("[main] unhandled rejection:", reason);
});

function focusMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    } catch (err) {
        console.warn(`[main] could not focus main window: ${err?.message || err}`);
    }
}

function broadcastToAllWindows(channel, payload) {
    for (const win of BrowserWindow.getAllWindows()) {
        try {
            if (!win || win.isDestroyed?.() || !win.webContents || win.webContents.isDestroyed?.()) {
                continue;
            }
            win.webContents.send(channel, payload);
        } catch (err) {
            console.warn(`[main] failed to broadcast to window: ${err?.message || err}`);
        }
    }
}

function broadcastAuthSession(session) {
    broadcastToAllWindows(CHANNELS.AUTH_SESSION_UPDATE, session);
}

function broadcastBlockerSession(view) {
    broadcastToAllWindows(CHANNELS.SESSION_UPDATE_EVENT, view);
}

function registerAllIpcHandlers() {
    ipcMain.handle(CHANNELS.AUTH_SIGN_IN, (_e, payload) => authService.signInWithEmail(payload));
    ipcMain.handle(CHANNELS.AUTH_SIGN_UP, (_e, payload) => authService.signUpWithEmail(payload));
    ipcMain.handle(CHANNELS.AUTH_SIGN_OUT, () => authService.signOut());
    ipcMain.handle(CHANNELS.AUTH_GET_SESSION, () => authService.getSession());
    ipcMain.handle(CHANNELS.AUTH_SIGN_IN_WITH_GOOGLE, () => authService.signInWithGoogle());

    ipcMain.handle(CHANNELS.DATA_LOAD_ONBOARDING, () => webServerService.loadOnboarding());
    ipcMain.handle(CHANNELS.DATA_SAVE_ONBOARDING, (_e, payload) =>
        webServerService.saveOnboarding(payload)
    );
    ipcMain.handle(CHANNELS.DATA_SAVE_SESSION_POINTS, (_e, payload) =>
        webServerService.saveSessionPoints(payload)
    );
    ipcMain.handle(CHANNELS.DATA_GET_USER_TOTAL_POINTS, () =>
        webServerService.getUserTotalPoints()
    );

    ipcMain.handle(CHANNELS.WEBSERVER_GET_CURRENT_SESSION, () =>
        webServerService.getCurrentSession()
    );
    ipcMain.handle(CHANNELS.WEBSERVER_CREATE_SESSION, (_e, payload) =>
        webServerService.createSession(payload)
    );
    ipcMain.handle(CHANNELS.WEBSERVER_END_SESSION, (_e, sessionId) =>
        webServerService.endSession(sessionId)
    );
    ipcMain.handle(CHANNELS.WEBSERVER_LIST_GROUPS, () => webServerService.listGroups());
    ipcMain.handle(CHANNELS.WEBSERVER_CREATE_GROUP, (_e, payload) =>
        webServerService.createGroup(payload)
    );
    ipcMain.handle(CHANNELS.WEBSERVER_JOIN_GROUP, (_e, payload) =>
        webServerService.joinGroup(payload)
    );
    ipcMain.handle(CHANNELS.WEBSERVER_GET_GROUP_LEADERBOARD, (_e, groupId) =>
        webServerService.getGroupLeaderboard(groupId)
    );
    ipcMain.handle(CHANNELS.WEBSERVER_SYNC_DEFAULT_GROUPS, (_e, payload) =>
        webServerService.syncDefaultGroups(payload)
    );

    ipcMain.handle(CHANNELS.SESSION_START, (_e, cfg) => blockerService.startSession(cfg));
    ipcMain.handle(CHANNELS.SESSION_UPDATE, (_e, cfg) => blockerService.updateSession(cfg));
    ipcMain.handle(CHANNELS.SESSION_GET, () => blockerService.getSession());
    ipcMain.handle(CHANNELS.SESSION_STOP, () => blockerService.stopSession("manual"));
    ipcMain.handle(CHANNELS.EXTENSION_STATUS, () => extensionBridge.status());
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
    app.quit();
} else {
    app.on("second-instance", () => {
        focusMainWindow();
    });
}

if (!process.env.APPDATA) {
    app.setPath("userData", path.join(app.getAppPath(), ".cache", "tether"));
    app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
}

function createWindow() {
    let win;
    try {
        win = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                preload: path.join(__dirname, "preload.js"),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false,
            },
        });
    } catch (err) {
        console.error("[main] failed to create main window:", err);
        throw err;
    }

    mainWindow = win;
    win.on("closed", () => {
        if (mainWindow === win) mainWindow = null;
    });

    win.webContents.on("did-fail-load", (_e, code, desc, url) => {
        console.error(`[window] failed to load ${url}: ${desc} (${code})`);
    });

    win.webContents.on("console-message", (_e, level, message, line, sourceId) => {
        const tag = ["log", "warn", "error"][level] || "log";
        console.log(`[renderer:${tag}] ${message}  (${sourceId}:${line})`);
    });

    win.webContents.on("render-process-gone", (_e, details) => {
        console.error("[window] render process gone:", details.reason, details.exitCode);
    });

    try {
        if (isDev) {
            win.loadURL("http://localhost:5173").catch((err) => {
                console.error("[main] failed to load dev URL:", err);
            });
            win.webContents.openDevTools({ mode: "right" });
        } else {
            win.setMenuBarVisibility(false);
            win.setMenu(null);
            win.loadFile(path.join(__dirname, "../../dist/index.html")).catch((err) => {
                console.error("[main] failed to load renderer file:", err);
            });
        }
    } catch (err) {
        console.error("[main] window initialization failed:", err);
        throw err;
    }
}

if (gotSingleInstanceLock) {
    app.whenReady().then(async () => {
        authService.initialize({ onSessionChange: broadcastAuthSession });
        blockerService.initialize({
            onSessionChange: broadcastBlockerSession,
            extensionBridge,
        });
        registerAllIpcHandlers();
        createWindow();
    });

    app.on("will-quit", () => {
        blockerService.stop();
    });
}
