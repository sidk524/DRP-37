const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('tether', {
    getOAuthRedirectUrl: () => ipcRenderer.invoke('oauth:redirect-url'),
    oauthLogin: (url) => ipcRenderer.invoke('oauth:login', url),
    startSession: (config) => ipcRenderer.invoke('session:start', config),
    updateSession: (config) => ipcRenderer.invoke('session:update', config),
    stopSession: () => ipcRenderer.invoke('session:stop'),
    getSession: () => ipcRenderer.invoke('session:get'),
    getExtensionStatus: () => ipcRenderer.invoke('extension:status'),
    webServerRequest: (payload) => ipcRenderer.invoke('webserver:request', payload),
    onSessionUpdate: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on('session:update', listener);
        return () => ipcRenderer.removeListener('session:update', listener);
    },
})

contextBridge.exposeInMainWorld("electronAPI", {
    submitAuthForm: (payload) => ipcRenderer.invoke("auth:submit", payload),
});