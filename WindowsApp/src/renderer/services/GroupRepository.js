function requireTether() {
    if (!window.tether) {
        throw new Error("Tether desktop API is not available.");
    }
    return window.tether;
}

export async function listGroups() {
    return requireTether().listGroups();
}

export async function createGroup({ name }) {
    return requireTether().createGroup({ name });
}

export async function joinGroup({ inviteCode }) {
    return requireTether().joinGroup({ inviteCode });
}

export async function getGroupLeaderboard(groupId) {
    return requireTether().getGroupLeaderboard(groupId);
}

export async function syncDefaultGroups({ scrollingWorst }) {
    return requireTether().syncDefaultGroups({ scrollingWorst });
}
