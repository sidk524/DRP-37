const { contextBridge, ipcRenderer } = require("electron");

const IPC_CHANNELS = Object.freeze({
    sessionStart: "session:start",
    sessionUpdate: "session:update",
    sessionStop: "session:stop",
    sessionGet: "session:get",
    extensionStatus: "extension:status",
    oauthLogin: "oauth:login",
    oauthRedirectUrl: "oauth:redirect-url",
    authSubmit: "auth:submit",
    webServerRequest: "webserver:request",
});

const IPC_EVENTS = Object.freeze({
    sessionUpdate: "session:update",
});

async function invoke(channel, payload) {
    try {
        return await ipcRenderer.invoke(channel, payload);
    } catch (err) {
        const wrapped = new Error(`IPC invoke failed for '${channel}': ${err?.message || err}`);
        wrapped.cause = err;
        throw wrapped;
    }
}

contextBridge.exposeInMainWorld("tether", {
    getOAuthRedirectUrl: () => invoke(IPC_CHANNELS.oauthRedirectUrl),
    oauthLogin: (url) => invoke(IPC_CHANNELS.oauthLogin, url),
    startSession: (config) => invoke(IPC_CHANNELS.sessionStart, config),
    updateSession: (config) => invoke(IPC_CHANNELS.sessionUpdate, config),
    stopSession: () => invoke(IPC_CHANNELS.sessionStop),
    getSession: () => invoke(IPC_CHANNELS.sessionGet),
    getExtensionStatus: () => invoke(IPC_CHANNELS.extensionStatus),
    webServerRequest: (payload) => invoke(IPC_CHANNELS.webServerRequest, payload),
    onSessionUpdate: (callback) => {
        if (typeof callback !== "function") {
            throw new TypeError("onSessionUpdate callback must be a function.");
        }
        const listener = (_event, data) => callback(data);
        ipcRenderer.on(IPC_EVENTS.sessionUpdate, listener);
        return () => ipcRenderer.removeListener(IPC_EVENTS.sessionUpdate, listener);
    },
});

contextBridge.exposeInMainWorld("electronAPI", {
    submitAuthForm: (payload) => invoke(IPC_CHANNELS.authSubmit, payload),
});