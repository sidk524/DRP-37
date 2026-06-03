const { contextBridge, ipcRenderer } = require('electron')

// Expose safe APIs to the React renderer
contextBridge.exposeInMainWorld('tether', {
    // ── Auth ──
    // Open a Google OAuth consent popup; resolves to { access_token,
    // refresh_token } on success, or null if the user cancels.
    oauthLogin: (url) => ipcRenderer.invoke('oauth:login', url),

    // ── Session control (BlockerSetup) ──
    // config: { apps: string[] (match tokens), appLabels: string[], mode, durationMinutes }
    startSession: (config) => ipcRenderer.invoke('session:start', config),
    stopSession: () => ipcRenderer.invoke('session:stop'),
    getSession: () => ipcRenderer.invoke('session:get'),
    // Subscribe to session state changes; returns an unsubscribe function.
    onSessionUpdate: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on('session:update', listener);
        return () => ipcRenderer.removeListener('session:update', listener);
    },

    // ── Friction overlay ──
    // Subscribe to "show friction" events; returns an unsubscribe function.
    onShowFriction: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on('friction:show', listener);
        return () => ipcRenderer.removeListener('friction:show', listener);
    },
    // User proceeds to the app (starts the grace period).
    continueThrough: (key) => ipcRenderer.send('friction:continue', { key }),
    // User backs out of opening the app (mode lets hard-block skip grace).
    notNow: (key, mode) => ipcRenderer.send('friction:notNow', { key, mode }),
})

contextBridge.exposeInMainWorld("electronAPI", {
    submitAuthForm: (payload) => ipcRenderer.invoke("auth:submit", payload),
});