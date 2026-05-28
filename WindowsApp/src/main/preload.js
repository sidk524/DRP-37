const { contextBridge, ipcRenderer } = require('electron')

// Expose safe APIs to the React renderer
contextBridge.exposeInMainWorld('tether', {
    // Example — send a message to the main process
    startSession: (config) => ipcRenderer.send('start-session', config),
    stopSession: () => ipcRenderer.send('stop-session'),

    // Example — receive updates from the main process
    onUsageUpdate: (callback) => ipcRenderer.on('usage-update', callback),
})

contextBridge.exposeInMainWorld("electronAPI", {
    submitAuthForm: (payload) => ipcRenderer.invoke("auth:submit", payload),
});