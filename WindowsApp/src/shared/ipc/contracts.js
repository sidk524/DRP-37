/**
 * Shared IPC contracts used by Electron main/preload and renderer layers.
 * Keep channel names and payload/result shapes centralized.
 */

const IPC_CHANNELS = Object.freeze({
    oauthRedirectUrl: "oauth:redirect-url",
    oauthLogin: "oauth:login",
    sessionStart: "session:start",
    sessionUpdate: "session:update",
    sessionStop: "session:stop",
    sessionGet: "session:get",
    extensionStatus: "extension:status",
    webServerRequest: "webserver:request",
    authSubmit: "auth:submit",
});

const IPC_EVENTS = Object.freeze({
    sessionUpdate: "session:update",
});

module.exports = {
    IPC_CHANNELS,
    IPC_EVENTS,
};
