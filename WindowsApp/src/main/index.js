const { app, BrowserWindow } = require("electron");
const path = require("path");
const { registerAuthHandlers } = require("./handlers/authHandler");

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

    if (process.env.NODE_ENV === "development") {
        win.loadURL("http://localhost:5173");
    } else {
        /* Hide menu bar and menu */
        win.setMenuBarVisibility(false);
        win.setMenu(null);

        win.loadFile(path.join(__dirname, "../../dist/index.html"));
    }
}

registerAuthHandlers();

app.whenReady().then(createWindow);