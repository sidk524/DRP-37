const path = require("path");
const { contextBridge, ipcRenderer } = require("electron");
const CHANNELS = require(path.join(__dirname, "ipc", "channels.js"));

contextBridge.exposeInMainWorld("tether", {
    signInWithEmail: (email, password) =>
        ipcRenderer.invoke(CHANNELS.AUTH_SIGN_IN, { email, password }),
    signUpWithEmail: (email, password) =>
        ipcRenderer.invoke(CHANNELS.AUTH_SIGN_UP, { email, password }),
    signOut: () => ipcRenderer.invoke(CHANNELS.AUTH_SIGN_OUT),
    getSession: () => ipcRenderer.invoke(CHANNELS.AUTH_GET_SESSION),
    signInWithGoogle: () => ipcRenderer.invoke(CHANNELS.AUTH_SIGN_IN_WITH_GOOGLE),
    onAuthStateChange: (callback) => {
        const listener = (_event, session) => callback(session);
        ipcRenderer.on(CHANNELS.AUTH_SESSION_UPDATE, listener);
        return () => ipcRenderer.removeListener(CHANNELS.AUTH_SESSION_UPDATE, listener);
    },

    loadOnboarding: () => ipcRenderer.invoke(CHANNELS.DATA_LOAD_ONBOARDING),
    saveOnboarding: (payload) => ipcRenderer.invoke(CHANNELS.DATA_SAVE_ONBOARDING, payload),

    getCurrentSession: () => ipcRenderer.invoke(CHANNELS.WEBSERVER_GET_CURRENT_SESSION),
    createSession: (payload) => ipcRenderer.invoke(CHANNELS.WEBSERVER_CREATE_SESSION, payload),
    endSession: (sessionId) => ipcRenderer.invoke(CHANNELS.WEBSERVER_END_SESSION, sessionId),
    listGroups: () => ipcRenderer.invoke(CHANNELS.WEBSERVER_LIST_GROUPS),
    createGroup: (payload) => ipcRenderer.invoke(CHANNELS.WEBSERVER_CREATE_GROUP, payload),
    joinGroup: (payload) => ipcRenderer.invoke(CHANNELS.WEBSERVER_JOIN_GROUP, payload),
    getGroupLeaderboard: (groupId) =>
        ipcRenderer.invoke(CHANNELS.WEBSERVER_GET_GROUP_LEADERBOARD, groupId),
    syncDefaultGroups: (payload) =>
        ipcRenderer.invoke(CHANNELS.WEBSERVER_SYNC_DEFAULT_GROUPS, payload),

    startSession: (config) => ipcRenderer.invoke(CHANNELS.SESSION_START, config),
    updateSession: (config) => ipcRenderer.invoke(CHANNELS.SESSION_UPDATE, config),
    stopSession: () => ipcRenderer.invoke(CHANNELS.SESSION_STOP),
    getBlockerSession: () => ipcRenderer.invoke(CHANNELS.SESSION_GET),
    getExtensionStatus: () => ipcRenderer.invoke(CHANNELS.EXTENSION_STATUS),
    onSessionUpdate: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on(CHANNELS.SESSION_UPDATE_EVENT, listener);
        return () => ipcRenderer.removeListener(CHANNELS.SESSION_UPDATE_EVENT, listener);
    },
});
