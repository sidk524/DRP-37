import { useEffect, useState } from "react";
import { getUserGroup, listGroups } from "../services/SupabaseClient";
import "../styles/Onboarding.css";
import "../styles/Settings.css";

function Leaderboard({ session, onBack, onJoin }) {
    const [groups, setGroups] = useState([]);
    const [currentGroupId, setCurrentGroupId] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        Promise.all([listGroups(), getUserGroup(session.user.id)])
            .then(([list, current]) => {
                if (!active) return;
                setGroups(list);
                if (current) setCurrentGroupId(current.id);
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

    return (
        <div className="tether-screen settings-screen">
            <div className="settings-frame">
                <div className="tether-topbar">
                    <button type="button" className="tether-back" onClick={onBack}>
                        <span className="tether-back-chevron" aria-hidden />
                        Back
                    </button>
                    <span className="tether-topbar-duration">Leaderboard</span>
                    <span className="tether-topbar-spacer" aria-hidden />
                </div>

                <h1 className="settings-title">Group standings</h1>
                <p className="settings-subtitle">Groups ranked by total focus points.</p>

                {loading ? (
                    <p className="settings-status">Loading…</p>
                ) : groups.length === 0 ? (
                    <p className="settings-status">No groups yet — be the first to start one.</p>
                ) : (
                    <div className="group-list">
                        {groups.map((group, index) => (
                            <div
                                key={group.id}
                                className={`group-card ${group.id === currentGroupId ? "selected" : ""}`}
                            >
                                <span className="group-rank">#{index + 1}</span>
                                <span className="group-info">
                                    <span className="group-name">
                                        {group.name}
                                        {group.id === currentGroupId ? " · you" : ""}
                                    </span>
                                    <span className="group-meta">
                                        {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
                                    </span>
                                </span>
                                <span className="group-points">{group.totalPoints} pts</span>
                            </div>
                        ))}
                    </div>
                )}

                <button
                    type="button"
                    className="btn-continue onboarding-cta settings-save"
                    onClick={onJoin}
                >
                    Join or switch group
                </button>
            </div>
        </div>
    );
}

export default Leaderboard;
