const { app, BrowserWindow } = require('electron')
const path = require('path')

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js') // Optional but recommended
        }
    })

    if (isDev) {
        // In development — load from Vite dev server
        win.loadURL('http://localhost:5173')
        win.webContents.openDevTools() // Open devtools automatically in dev
    } else {
        // In production — load built files
        win.loadFile(path.join(__dirname, '../renderer/index.html'))
    }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
})