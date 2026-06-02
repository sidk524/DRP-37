// Manages the full-screen friction overlay window.
//
// It loads the same React bundle as the main window but navigates to the
// "#/friction" route. We create it once (hidden) at startup so it's ready to
// show instantly — avoiding the flicker where the blocked app is briefly
// visible before the overlay appears.

const { BrowserWindow } = require("electron");
const path = require("path");

let overlayWin = null;
let loaded = false;
let pendingShow = null; // appInfo queued while the window is still loading

function buildOverlay() {
    const win = new BrowserWindow({
        show: false,
        frame: false,
        fullscreen: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        backgroundColor: "#111111",
        webPreferences: {
            preload: path.join(__dirname, "..", "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Float above virtually everything, including the taskbar / other apps.
    win.setAlwaysOnTop(true, "screen-saver");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    if (process.env.NODE_ENV === "development") {
        win.loadURL("http://localhost:5173/#/friction");
    } else {
        win.loadFile(path.join(__dirname, "../../../dist/index.html"), {
            hash: "/friction",
        });
    }

    win.webContents.on("did-finish-load", () => {
        loaded = true;
        if (pendingShow) {
            const info = pendingShow;
            pendingShow = null;
            doShow(info);
        }
    });

    win.on("closed", () => {
        overlayWin = null;
        loaded = false;
    });

    return win;
}

function doShow(appInfo) {
    if (!overlayWin) return;
    overlayWin.webContents.send("friction:show", appInfo);
    overlayWin.show();
    overlayWin.focus();
    overlayWin.setAlwaysOnTop(true, "screen-saver");
}

// Create the hidden overlay window ahead of time.
function preload() {
    if (!overlayWin) overlayWin = buildOverlay();
}

// Show the friction screen for the given { app, key, title }.
function showFriction(appInfo) {
    if (!overlayWin) overlayWin = buildOverlay();
    if (!loaded) {
        pendingShow = appInfo;
        return;
    }
    doShow(appInfo);
}

function hideFriction() {
    if (overlayWin && overlayWin.isVisible()) overlayWin.hide();
}

function isVisible() {
    return !!overlayWin && overlayWin.isVisible();
}

function destroy() {
    if (overlayWin) {
        overlayWin.destroy();
        overlayWin = null;
        loaded = false;
    }
}

module.exports = { preload, showFriction, hideFriction, isVisible, destroy };
