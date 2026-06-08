const { app, BrowserWindow } = require("electron");
const path = require("path");
const { registerAuthHandlers } = require("./handlers/authHandler");
const { registerWebServerHandlers } = require("./handlers/webServerHandler");
const { registerOAuthIpc } = require("./auth/registerOAuthIpc");
const blockerService = require("./blocker/blockerService");

const isDev = process.env.NODE_ENV === "development";

let mainWindow = null;
let mainBootstrapCompleted = false;

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

function bootstrapIpcHandlers() {
    registerAuthHandlers();
    registerWebServerHandlers();
    registerOAuthIpc();
}

if (gotSingleInstanceLock) {
    app.whenReady().then(() => {
        try {
            if (!mainBootstrapCompleted) {
                bootstrapIpcHandlers();
                mainBootstrapCompleted = true;
            }
            createWindow();
            blockerService.start();
        } catch (err) {
            console.error("[main] startup failed:", err);
            app.quit();
        }
    });

    app.on("will-quit", () => {
        try {
            blockerService.stop();
        } catch (err) {
            console.error("[main] blocker service shutdown failed:", err);
        }
    });
}
