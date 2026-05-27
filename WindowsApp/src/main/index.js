const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
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

app.whenReady().then(createWindow);