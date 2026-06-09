const path = require("path");
const { contextBridge, ipcRenderer } = require("electron");
const CHANNELS = require(path.join(__dirname, "ipc", "channels.js"));

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
    signInWithEmail: (email, password) =>
        invoke(CHANNELS.AUTH_SIGN_IN, { email, password }),
    signUpWithEmail: (email, password) =>
        invoke(CHANNELS.AUTH_SIGN_UP, { email, password }),
    signOut: () => invoke(CHANNELS.AUTH_SIGN_OUT),
    getSession: () => invoke(CHANNELS.AUTH_GET_SESSION),
    signInWithGoogle: () => invoke(CHANNELS.AUTH_SIGN_IN_WITH_GOOGLE),
    onAuthStateChange: (callback) => {
        const listener = (_event, session) => callback(session);
        ipcRenderer.on(CHANNELS.AUTH_SESSION_UPDATE, listener);
        return () => ipcRenderer.removeListener(CHANNELS.AUTH_SESSION_UPDATE, listener);
    },

    loadOnboarding: () => invoke(CHANNELS.DATA_LOAD_ONBOARDING),
    saveOnboarding: (payload) => invoke(CHANNELS.DATA_SAVE_ONBOARDING, payload),
    saveSessionPoints: (payload) => invoke(CHANNELS.DATA_SAVE_SESSION_POINTS, payload),
    getUserTotalPoints: () => invoke(CHANNELS.DATA_GET_USER_TOTAL_POINTS),

    getCurrentSession: () => invoke(CHANNELS.WEBSERVER_GET_CURRENT_SESSION),
    createSession: (payload) => invoke(CHANNELS.WEBSERVER_CREATE_SESSION, payload),
    endSession: (sessionId) => invoke(CHANNELS.WEBSERVER_END_SESSION, sessionId),
    listGroups: () => invoke(CHANNELS.WEBSERVER_LIST_GROUPS),
    createGroup: (payload) => invoke(CHANNELS.WEBSERVER_CREATE_GROUP, payload),
    joinGroup: (payload) => invoke(CHANNELS.WEBSERVER_JOIN_GROUP, payload),
    getGroupLeaderboard: (groupId) =>
        invoke(CHANNELS.WEBSERVER_GET_GROUP_LEADERBOARD, groupId),
    syncDefaultGroups: (payload) =>
        invoke(CHANNELS.WEBSERVER_SYNC_DEFAULT_GROUPS, payload),

    startSession: (config) => invoke(CHANNELS.SESSION_START, config),
    updateSession: (config) => invoke(CHANNELS.SESSION_UPDATE, config),
    stopSession: () => invoke(CHANNELS.SESSION_STOP),
    getBlockerSession: () => invoke(CHANNELS.SESSION_GET),
    getExtensionStatus: () => invoke(CHANNELS.EXTENSION_STATUS),
    onSessionUpdate: (callback) => {
        if (typeof callback !== "function") {
            throw new TypeError("onSessionUpdate callback must be a function.");
        }
        const listener = (_event, data) => callback(data);
        ipcRenderer.on(CHANNELS.SESSION_UPDATE_EVENT, listener);
        return () => ipcRenderer.removeListener(CHANNELS.SESSION_UPDATE_EVENT, listener);
    },
});
