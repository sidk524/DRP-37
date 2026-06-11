function requireTether() {
    if (!window.tether) {
        throw new Error("Tether desktop API is not available.");
    }
    return window.tether;
}

const LAST_BLOCK_GROUP_KEY = "tether:lastBlockGroupId:v1";

function canUseLocalStorage() {
    return typeof window !== "undefined" && !!window.localStorage;
}

export function loadLastBlockGroupId() {
    if (!canUseLocalStorage()) return null;
    try {
        return window.localStorage.getItem(LAST_BLOCK_GROUP_KEY) || null;
    } catch (error) {
        console.warn("Failed to load last block group id:", error);
        return null;
    }
}

export function saveLastBlockGroupId(groupId) {
    if (!canUseLocalStorage()) return;
    try {
        if (groupId) {
            window.localStorage.setItem(LAST_BLOCK_GROUP_KEY, String(groupId));
        } else {
            window.localStorage.removeItem(LAST_BLOCK_GROUP_KEY);
        }
    } catch (error) {
        console.warn("Failed to save last block group id:", error);
    }
}

export async function listBlockGroups() {
    return requireTether().listBlockGroups();
}

export async function createBlockGroup({ name, targets = [], appsBlocked = [], domainsBlocked = [] }) {
    return requireTether().createBlockGroup({ name, targets, appsBlocked, domainsBlocked });
}

export async function updateBlockGroup({ id, name, targets, appsBlocked, domainsBlocked }) {
    return requireTether().updateBlockGroup({ id, name, targets, appsBlocked, domainsBlocked });
}

export async function deleteBlockGroup(groupId) {
    return requireTether().deleteBlockGroup(groupId);
}
