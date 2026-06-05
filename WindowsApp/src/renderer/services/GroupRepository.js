import { request } from "./WebServerClient";

export async function listGroups() {
    const data = await request("/api/groups");
    return data.groups || [];
}

export async function createGroup({ name }) {
    const data = await request("/api/groups", {
        method: "POST",
        body: { name },
    });
    return data.group;
}

export async function joinGroup({ inviteCode }) {
    const data = await request("/api/groups/join", {
        method: "POST",
        body: { inviteCode },
    });
    return data.group;
}

export async function getGroupLeaderboard(groupId) {
    const data = await request(`/api/groups/${encodeURIComponent(groupId)}/leaderboard`);
    return data.leaderboard || [];
}
