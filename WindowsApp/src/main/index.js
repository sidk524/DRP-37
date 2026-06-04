const { app, BrowserWindow } = require("electron");
const path = require("path");
const { registerAuthHandlers } = require("./handlers/authHandler");
const { registerOAuthIpc } = require("./auth/registerOAuthIpc");
const blockerService = require("./blocker/blockerService");

const isDev = process.env.NODE_ENV === "development";

let mainWindow = null;

function focusMainWindow() {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
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
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

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

    if (isDev) {
        win.loadURL("http://localhost:5173");
        win.webContents.openDevTools({ mode: "right" });
    } else {
        win.setMenuBarVisibility(false);
        win.setMenu(null);
        win.loadFile(path.join(__dirname, "../../dist/index.html"));
    }
}

registerAuthHandlers();
registerOAuthIpc();

if (gotSingleInstanceLock) {
    app.whenReady().then(() => {
        createWindow();
        blockerService.start();
    });

    app.on("will-quit", () => {
        blockerService.stop();
    });
}
