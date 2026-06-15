/** @typedef {{ ok: boolean, error?: string, session?: object }} SessionResult */

export function tetherApi() {
    return typeof window !== "undefined" ? window.tether : undefined;
}

export function isTetherBridgeAvailable() {
    return !!tetherApi();
}

function getRequiredTetherMethod(methodName) {
    const api = tetherApi();
    const method = api?.[methodName];
    if (typeof method !== "function") {
        throw new Error(`Tether desktop bridge is unavailable for '${methodName}'.`);
    }
    return method.bind(api);
}

export async function startTetherSession(config) {
    return getRequiredTetherMethod("startSession")(config);
}

export async function updateTetherSession(config) {
    return getRequiredTetherMethod("updateSession")(config);
}

export async function stopTetherSession(config) {
    return getRequiredTetherMethod("stopSession")(config);
}

export async function getTetherSession() {
    if (!isTetherBridgeAvailable()) return null;
    return getRequiredTetherMethod("getBlockerSession")();
}

export function onTetherSessionUpdate(callback) {
    if (typeof callback !== "function") {
        throw new TypeError("Session update callback must be a function.");
    }
    if (!isTetherBridgeAvailable()) {
        return () => {};
    }
    return getRequiredTetherMethod("onSessionUpdate")(callback);
}

export function onRemoteSessionSync(callback) {
    if (typeof callback !== "function") {
        throw new TypeError("Remote session sync callback must be a function.");
    }
    const api = tetherApi();
    if (typeof api?.onRemoteSessionSync !== "function") {
        return () => {};
    }
    return api.onRemoteSessionSync(callback);
}
