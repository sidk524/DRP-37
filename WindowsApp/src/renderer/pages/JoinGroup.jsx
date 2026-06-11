import { useEffect, useState } from "react";
import {
    createGroup,
    getUserGroup,
    joinGroup,
    listGroups,
} from "../services/SupabaseClient";
import "../styles/Onboarding.css";
import "../styles/Settings.css";

function JoinGroup({ session, onBack, onJoined }) {
    const [groups, setGroups] = useState([]);
    const [currentGroupId, setCurrentGroupId] = useState(null);
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [newGroupName, setNewGroupName] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        Promise.all([listGroups(), getUserGroup(session.user.id)])
            .then(([list, current]) => {
                if (!active) return;
                setGroups(list);
                if (current) {
                    setCurrentGroupId(current.id);
                    setSelectedGroupId(current.id);
                }
            })
            .catch(() => {
                /* leave empty on failure */
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [session.user.id]);

    const canJoin = !!selectedGroupId || newGroupName.trim().length > 0;

    async function handleJoin() {
        if (!canJoin) return;
        setSaving(true);
        setError("");
        try {
            if (newGroupName.trim()) {
                await createGroup(session.user.id, newGroupName);
            } else if (selectedGroupId && selectedGroupId !== currentGroupId) {
                await joinGroup(session.user.id, selectedGroupId);
            }
            onJoined?.();
        } catch (err) {
            setError(err.message || "Could not join group.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="tether-screen settings-screen">
            <div className="settings-frame">
                <div className="tether-topbar">
                    <button type="button" className="tether-back" onClick={onBack}>
                        <span className="tether-back-chevron" aria-hidden />
                        Back
                    </button>
                    <span className="tether-topbar-duration">Social</span>
                    <span className="tether-topbar-spacer" aria-hidden />
                </div>

                <h1 className="settings-title">Join a group</h1>
                <p className="settings-subtitle">
                    Pick a group to compete with — or start your own.
                </p>

                {loading ? (
                    <p className="settings-status">Loading…</p>
                ) : (
                    <div className="group-step">
                        {groups.length > 0 && (
                            <div className="group-list">
                                {groups.map((group, index) => (
                                    <button
                                        key={group.id}
                                        type="button"
                                        className={`group-card ${
                                            selectedGroupId === group.id ? "selected" : ""
                                        }`}
                                        onClick={() => {
                                            setSelectedGroupId(group.id);
                                            setNewGroupName("");
                                        }}
                                    >
                                        <span className="group-rank">#{index + 1}</span>
                                        <span className="group-info">
                                            <span className="group-name">
                                                {group.name}
                                                {group.id === currentGroupId ? " · current" : ""}
                                            </span>
                                            <span className="group-meta">
                                                {group.memberCount} member
                                                {group.memberCount === 1 ? "" : "s"}
                                            </span>
                                        </span>
                                        <span className="group-points">{group.totalPoints} pts</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="group-create">
                            <p className="group-create-label">Or start a new group</p>
                            <input
                                type="text"
                                className="onboarding-textarea group-create-input"
                                placeholder="New group name"
                                value={newGroupName}
                                maxLength={40}
                                onChange={(e) => {
                                    setNewGroupName(e.target.value);
                                    if (e.target.value.trim()) setSelectedGroupId(null);
                                }}
                            />
                        </div>
                    </div>
                )}

                {error && <p className="auth-error onboarding-error settings-error">{error}</p>}

                <button
                    type="button"
                    className="btn-continue onboarding-cta settings-save"
                    disabled={!canJoin || saving}
                    onClick={handleJoin}
                >
                    {saving ? "Joining…" : "Join group"}
                </button>
            </div>
        </div>
    );
}

export default JoinGroup;
