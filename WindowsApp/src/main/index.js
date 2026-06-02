const { app, BrowserWindow } = require("electron");
const path = require("path");
const { registerAuthHandlers } = require("./handlers/authHandler");
const blockerService = require("./blocker/blockerService");

// When launched from a WSL shell, the Windows electron.exe doesn't inherit
// %APPDATA%, so Chromium can't resolve a writable cache dir and dies with
// "Unable to move the cache: Access is denied (0x5)". Detect that case and
// redirect userData to a writable, app-relative path. A normal Windows launch
// (APPDATA set) is left untouched and uses the conventional AppData location.
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

    // Surface renderer load failures instead of a silent blank window.
    win.webContents.on("did-fail-load", (_e, code, desc, url) => {
        console.error(`[window] failed to load ${url}: ${desc} (${code})`);
    });

    if (process.env.NODE_ENV === "development") {
        win.loadURL("http://localhost:5173");
        win.webContents.openDevTools({ mode: "right" });
    } else {
        /* Hide menu bar and menu */
        win.setMenuBarVisibility(false);
        win.setMenu(null);

        win.loadFile(path.join(__dirname, "../../dist/index.html"));
    }
}

registerAuthHandlers();

app.whenReady().then(() => {
    createWindow();
    blockerService.start();
});

app.on("will-quit", () => {
    blockerService.stop();
});