import { useEffect, useState } from "react";
import {
    getAccountabilityInbox,
    markAccountabilityMessageRead,
    markAccountabilityNotificationRead,
    onAccountabilityEvent,
    sendAccountabilityMessage,
} from "../services/AccountabilityRepository";
import "../styles/Settings.css";

const PRESETS = [
    ["lock_in", "Lock in"],
    ["stay_focused", "Stay focused"],
    ["youve_got_this", "You've got this"],
];

export function useAccountabilityUnread() {
    const [unread, setUnread] = useState(0);
    useEffect(() => {
        getAccountabilityInbox().then((data) => setUnread(data.unreadCount || 0)).catch(() => {});
        return onAccountabilityEvent((event) => {
            if (event?.type === "accountability.unread") setUnread(event.unreadCount || 0);
            else if (event?.type?.startsWith("accountability.")) setUnread((value) => value + 1);
        });
    }, []);
    return [unread, setUnread];
}

export default function AccountabilityInbox({ onBack, onUnreadChange }) {
    const [items, setItems] = useState([]);
    const [error, setError] = useState("");
    const [drafts, setDrafts] = useState({});

    async function refresh() {
        try {
            const data = await getAccountabilityInbox();
            setItems(data.items || []);
            onUnreadChange?.(data.unreadCount || 0);
        } catch (err) { setError(err.message || "Could not load notifications."); }
    }

    useEffect(() => {
        refresh();
        return onAccountabilityEvent(() => refresh());
    }, []);

    async function markRead(item) {
        if (item.read_at) return;
        if (item.kind === "attempt") await markAccountabilityNotificationRead(item.id);
        else if (item.kind === "message") await markAccountabilityMessageRead(item.id);
        refresh();
    }

    async function reply(attemptId, payload) {
        try {
            await sendAccountabilityMessage(attemptId, payload);
            setDrafts((value) => ({ ...value, [attemptId]: "" }));
        } catch (err) { setError(err.message || "Could not send message."); }
    }

    return (
        <div className="tether-screen settings-screen">
            <div className="settings-frame">
                <div className="tether-topbar">
                    <button type="button" className="tether-back" onClick={onBack}>Back</button>
                    <span className="tether-topbar-duration">Notifications</span>
                    <span className="tether-topbar-spacer" />
                </div>
                <h1 className="settings-title">Accountability inbox</h1>
                {error && <p className="tether-error">{error}</p>}
                <div className="settings-stack">
                    {items.length === 0 && <p className="settings-status">No accountability notifications yet.</p>}
                    {items.map((item) => (
                        <section key={`${item.kind}-${item.id}`} className="settings-card" onClick={() => markRead(item)}>
                            {item.kind === "message" ? (
                                <>
                                    <p className="onboarding-section">Encouragement</p>
                                    <h2 className="settings-card-title">{item.body}</h2>
                                </>
                            ) : (
                                <>
                                    <p className="onboarding-section">{item.read_at ? "Attempt" : "New attempt"}</p>
                                    <h2 className="settings-card-title">
                                        {item.actorDisplayName} opened {item.attempt?.target_label}
                                    </h2>
                                    <p className="settings-subtitle">
                                        {item.attempt?.mode} · {(item.shared_groups || []).map((group) => group.name).join(", ")}
                                    </p>
                                    <div className="groups-form-row">
                                        {PRESETS.map(([key, label]) => (
                                            <button key={key} type="button" onClick={() => reply(item.attempt_id, { presetKey: key })}>{label}</button>
                                        ))}
                                    </div>
                                    <div className="groups-form-row">
                                        <input
                                            value={drafts[item.attempt_id] || ""}
                                            maxLength={280}
                                            placeholder="Write a private message"
                                            onChange={(event) => setDrafts((value) => ({ ...value, [item.attempt_id]: event.target.value }))}
                                        />
                                        <button type="button" onClick={() => reply(item.attempt_id, { body: drafts[item.attempt_id] || "" })}>Send</button>
                                    </div>
                                </>
                            )}
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}
