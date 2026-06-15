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
    endSession: (sessionId, reason) =>
        invoke(CHANNELS.WEBSERVER_END_SESSION, { sessionId, reason }),
    listGroups: () => invoke(CHANNELS.WEBSERVER_LIST_GROUPS),
    createGroup: (payload) => invoke(CHANNELS.WEBSERVER_CREATE_GROUP, payload),
    joinGroup: (payload) => invoke(CHANNELS.WEBSERVER_JOIN_GROUP, payload),
    getGroupLeaderboard: (groupId) =>
        invoke(CHANNELS.WEBSERVER_GET_GROUP_LEADERBOARD, groupId),
    getGroupPresence: (groupId) => invoke(CHANNELS.WEBSERVER_GET_GROUP_PRESENCE, groupId),
    getAccountabilityPreferences: () => invoke(CHANNELS.ACCOUNTABILITY_GET_PREFERENCES),
    updateAccountabilityPreferences: (payload) => invoke(CHANNELS.ACCOUNTABILITY_UPDATE_PREFERENCES, payload),
    reportAccountabilityAttempt: (payload) => invoke(CHANNELS.ACCOUNTABILITY_REPORT_ATTEMPT, payload),
    getAccountabilityInbox: () => invoke(CHANNELS.ACCOUNTABILITY_GET_INBOX),
    markAccountabilityNotificationRead: (id) => invoke(CHANNELS.ACCOUNTABILITY_MARK_READ, id),
    sendAccountabilityMessage: (attemptId, payload) =>
        invoke(CHANNELS.ACCOUNTABILITY_SEND_MESSAGE, { attemptId, payload }),
    syncDefaultGroups: (payload) =>
        invoke(CHANNELS.WEBSERVER_SYNC_DEFAULT_GROUPS, payload),
    listBlockGroups: () => invoke(CHANNELS.WEBSERVER_LIST_BLOCK_GROUPS),
    createBlockGroup: (payload) => invoke(CHANNELS.WEBSERVER_CREATE_BLOCK_GROUP, payload),
    updateBlockGroup: (payload) => invoke(CHANNELS.WEBSERVER_UPDATE_BLOCK_GROUP, payload),
    deleteBlockGroup: (groupId) => invoke(CHANNELS.WEBSERVER_DELETE_BLOCK_GROUP, groupId),
    patchSessionMode: (mode) => invoke(CHANNELS.WEBSERVER_PATCH_SESSION_MODE, mode),

    startSession: (config) => invoke(CHANNELS.SESSION_START, config),
    updateSession: (config) => invoke(CHANNELS.SESSION_UPDATE, config),
    stopSession: (config) => invoke(CHANNELS.SESSION_STOP, config),
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
    onRemoteSessionSync: (callback) => {
        if (typeof callback !== "function") {
            throw new TypeError("onRemoteSessionSync callback must be a function.");
        }
        const listener = (_event, data) => callback(data);
        ipcRenderer.on(CHANNELS.SESSION_REMOTE_SYNC, listener);
        return () => ipcRenderer.removeListener(CHANNELS.SESSION_REMOTE_SYNC, listener);
    },
    onAccountabilityEvent: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on(CHANNELS.ACCOUNTABILITY_EVENT, listener);
        return () => ipcRenderer.removeListener(CHANNELS.ACCOUNTABILITY_EVENT, listener);
    },
});
