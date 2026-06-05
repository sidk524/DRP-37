import { useEffect, useMemo, useState } from "react";
import {
    createGroup,
    getGroupLeaderboard,
    joinGroup,
    listGroups,
} from "../services/GroupRepository";
import "../styles/Groups.css";

function formatLockedTime(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}

function normalizeInviteCode(value) {
    return value.trim().toUpperCase().replace(/\s+/g, "");
}

function visibleErrorMessage(message) {
    const value = String(message || "").trim();
    return value === "Internal server error" ? "" : value;
}

function Groups({ onBack }) {
    const [groups, setGroups] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [groupName, setGroupName] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [loadingGroups, setLoadingGroups] = useState(true);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);

    const selectedGroup = useMemo(
        () => groups.find((group) => group.id === selectedGroupId) || null,
        [groups, selectedGroupId]
    );
    const visibleError = visibleErrorMessage(error);

    async function refreshGroups(preferredGroupId = selectedGroupId) {
        setLoadingGroups(true);
        setError("");
        try {
            const nextGroups = await listGroups();
            setGroups(nextGroups);
            const preferred = nextGroups.find((group) => group.id === preferredGroupId);
            setSelectedGroupId(preferred?.id || nextGroups[0]?.id || null);
        } catch (err) {
            setError(err.message || "Could not load groups.");
        } finally {
            setLoadingGroups(false);
        }
    }

    async function refreshLeaderboard(groupId) {
        if (!groupId) {
            setLeaderboard([]);
            return;
        }
        setLoadingLeaderboard(true);
        setError("");
        try {
            setLeaderboard(await getGroupLeaderboard(groupId));
        } catch (err) {
            setError(err.message || "Could not load leaderboard.");
        } finally {
            setLoadingLeaderboard(false);
        }
    }

    useEffect(() => {
        refreshGroups(null);
    }, []);

    useEffect(() => {
        refreshLeaderboard(selectedGroupId);
    }, [selectedGroupId]);

    async function handleCreateGroup() {
        const name = groupName.trim();
        if (!name || saving) return;
        setSaving(true);
        setError("");
        try {
            const group = await createGroup({ name });
            setGroupName("");
            await refreshGroups(group.id);
        } catch (err) {
            setError(err.message || "Could not create group.");
        } finally {
            setSaving(false);
        }
    }

    async function handleJoinGroup() {
        const code = normalizeInviteCode(inviteCode);
        if (!code || saving) return;
        setSaving(true);
        setError("");
        try {
            const group = await joinGroup({ inviteCode: code });
            setInviteCode("");
            await refreshGroups(group.id);
        } catch (err) {
            setError(err.message || "Could not join group.");
        } finally {
            setSaving(false);
        }
    }

    async function handleCopyInvite() {
        if (!selectedGroup?.inviteCode) return;
        await navigator.clipboard.writeText(`Join my Tether group with code: ${selectedGroup.inviteCode}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
    }

    return (
        <div className="tether-screen groups-screen">
            <div className="groups-frame">
                <div className="tether-topbar">
                    <button type="button" className="tether-back" onClick={onBack}>
                        <span className="tether-back-chevron" aria-hidden />
                        Back
                    </button>
                    <span className="tether-topbar-duration">Groups</span>
                    <span className="tether-topbar-spacer" aria-hidden />
                </div>

                <h1 className="groups-title">Friend leaderboards</h1>
                <p className="groups-subtitle">
                    Compete on all-time locked-in time from completed blocking sessions.
                </p>

                {visibleError && <p className="tether-error groups-error">{visibleError}</p>}

                <div className="groups-stack">
                    <section className="groups-card">
                        <p className="onboarding-section">My groups</p>
                        {loadingGroups ? (
                            <p className="groups-muted">Loading groups...</p>
                        ) : groups.length === 0 ? (
                            <p className="groups-muted">Create a group or enter an invite code to get started.</p>
                        ) : (
                            <div className="groups-list">
                                {groups.map((group) => (
                                    <button
                                        key={group.id}
                                        type="button"
                                        className={`groups-list-item ${selectedGroupId === group.id ? "selected" : ""}`}
                                        onClick={() => setSelectedGroupId(group.id)}
                                    >
                                        <span>{group.name}</span>
                                        <span>{group.memberCount} member{group.memberCount === 1 ? "" : "s"}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="groups-card">
                        <p className="onboarding-section">Create</p>
                        <div className="groups-form-row">
                            <input
                                type="text"
                                value={groupName}
                                onChange={(event) => setGroupName(event.target.value)}
                                placeholder="Group name"
                                maxLength={80}
                            />
                            <button
                                type="button"
                                onClick={handleCreateGroup}
                                disabled={!groupName.trim() || saving}
                            >
                                Create
                            </button>
                        </div>
                    </section>

                    <section className="groups-card">
                        <p className="onboarding-section">Join</p>
                        <div className="groups-form-row">
                            <input
                                type="text"
                                value={inviteCode}
                                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                                placeholder="Invite code"
                                maxLength={16}
                            />
                            <button
                                type="button"
                                onClick={handleJoinGroup}
                                disabled={!normalizeInviteCode(inviteCode) || saving}
                            >
                                Join
                            </button>
                        </div>
                    </section>

                    {selectedGroup && (
                        <section className="groups-card">
                            <div className="groups-card-heading">
                                <div>
                                    <p className="onboarding-section">Invite</p>
                                    <h2>{selectedGroup.name}</h2>
                                </div>
                                <button type="button" className="groups-copy" onClick={handleCopyInvite}>
                                    {copied ? "Copied" : "Copy code"}
                                </button>
                            </div>
                            <div className="groups-invite-code">{selectedGroup.inviteCode}</div>
                        </section>
                    )}

                    <section className="groups-card groups-leaderboard-card">
                        <p className="onboarding-section">Leaderboard</p>
                        {!selectedGroup ? (
                            <p className="groups-muted">Select or create a group to see the leaderboard.</p>
                        ) : loadingLeaderboard ? (
                            <p className="groups-muted">Loading leaderboard...</p>
                        ) : leaderboard.length === 0 ? (
                            <p className="groups-muted">No completed sessions yet.</p>
                        ) : (
                            <ol className="groups-leaderboard">
                                {leaderboard.map((entry) => (
                                    <li
                                        key={entry.userId}
                                        className={entry.isCurrentUser ? "current-user" : ""}
                                    >
                                        <span className="groups-rank">#{entry.rank}</span>
                                        <span className="groups-name">{entry.displayName}</span>
                                        <span className="groups-time">{formatLockedTime(entry.lockedSeconds)}</span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}

export default Groups;
