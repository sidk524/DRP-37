const { contextBridge, ipcRenderer } = require('electron')

// Expose safe APIs to the React renderer
contextBridge.exposeInMainWorld('tether', {
    // Example — send a message to the main process
    startSession: (config) => ipcRenderer.send('start-session', config),
    stopSession: () => ipcRenderer.send('stop-session'),

    // Example — receive updates from the main process
    onUsageUpdate: (callback) => ipcRenderer.on('usage-update', callback),

    // L1 mindful friction overlay
    // Subscribe to "show friction" events; returns an unsubscribe function.
    onShowFriction: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on('friction:show', listener);
        return () => ipcRenderer.removeListener('friction:show', listener);
    },
    // User proceeds to the app (starts the grace period).
    continueThrough: (key) => ipcRenderer.send('friction:continue', { key }),
    // User backs out of opening the app.
    notNow: (key) => ipcRenderer.send('friction:notNow', { key }),
})

contextBridge.exposeInMainWorld("electronAPI", {
    submitAuthForm: (payload) => ipcRenderer.invoke("auth:submit", payload),
});