const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { registerAuthHandlers } = require("./handlers/authHandler");
const blockerService = require("./blocker/blockerService");

// Google OAuth for a desktop app: instead of redirecting the main window away
// (which lands on the configured Supabase Site URL and shows the web server's
// JSON), open the consent screen in a popup and intercept the redirect. The
// implicit-flow tokens arrive in the URL fragment; we grab them before the
// target page loads, hand them back to the renderer, and never navigate away.
function openOAuthPopup(authUrl) {
    return new Promise((resolve) => {
        const popup = new BrowserWindow({
            width: 520,
            height: 680,
            title: "Sign in with Google",
            autoHideMenuBar: true,
            webPreferences: { contextIsolation: true, nodeIntegration: false },
        });

        let settled = false;
        const finish = (tokens) => {
            if (settled) return;
            settled = true;
            popup.removeListener("closed", onClosed);
            if (!popup.isDestroyed()) popup.close();
            resolve(tokens);
        };

        // Pull access_token / refresh_token out of a URL fragment, if present.
        const tryExtract = (url) => {
            const hashIndex = url.indexOf("#");
            if (hashIndex === -1) return false;
            const params = new URLSearchParams(url.slice(hashIndex + 1));
            const access_token = params.get("access_token");
            if (!access_token) return false;
            finish({ access_token, refresh_token: params.get("refresh_token") });
            return true;
        };

        const onNavigate = (event, url) => {
            // Stop the redirect to the Site URL from actually loading the
            // server page (no JSON flash) once we have the tokens.
            if (tryExtract(url)) {
                try { event.preventDefault(); } catch { /* did-navigate has no preventDefault */ }
            }
        };

        popup.webContents.on("will-redirect", onNavigate);
        popup.webContents.on("will-navigate", onNavigate);
        popup.webContents.on("did-navigate", (_e, url) => tryExtract(url));

        const onClosed = () => finish(null); // user closed the popup -> cancelled
        popup.on("closed", onClosed);

        popup.loadURL(authUrl);
    });
}

ipcMain.handle("oauth:login", (_e, authUrl) => openOAuthPopup(authUrl));

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

    // Mirror the renderer's console into the terminal so a blank window is
    // diagnosable without opening DevTools.
    win.webContents.on("console-message", (_e, level, message, line, sourceId) => {
        const tag = ["log", "warn", "error"][level] || "log";
        console.log(`[renderer:${tag}] ${message}  (${sourceId}:${line})`);
    });

    // Catch a hard renderer crash (white screen with no JS error).
    win.webContents.on("render-process-gone", (_e, details) => {
        console.error("[window] render process gone:", details.reason, details.exitCode);
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