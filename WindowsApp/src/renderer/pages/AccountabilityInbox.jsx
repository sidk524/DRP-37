import { useEffect, useState } from "react";
import NotificationBellIcon from "../components/NotificationBellIcon";
import {
    clearAccountabilityInbox,
    getAccountabilityInbox,
    markAccountabilityMessageRead,
    markAccountabilityNotificationRead,
    onAccountabilityEvent,
    sendAccountabilityMessage,
} from "../services/AccountabilityRepository";
import "../styles/Onboarding.css";
import "../styles/Settings.css";
import "../styles/AccountabilityInbox.css";

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
    const [unread, setUnread] = useState(0);
    const [error, setError] = useState("");
    const [drafts, setDrafts] = useState({});

    async function refresh() {
        try {
            const data = await getAccountabilityInbox();
            setItems(data.items || []);
            setUnread(data.unreadCount || 0);
            onUnreadChange?.(data.unreadCount || 0);
        } catch (err) { setError(err.message || "Could not load notifications."); }
    }

    useEffect(() => {
        refresh();
        return onAccountabilityEvent((event) => {
            if (event?.type === "accountability.unread") {
                setUnread(event.unreadCount || 0);
                onUnreadChange?.(event.unreadCount || 0);
                refresh();
            } else if (event?.type?.startsWith("accountability.")) {
                refresh();
            }
        });
    }, []);

    async function markRead(item) {
        if (item.read_at) return;
        if (item.kind === "attempt") await markAccountabilityNotificationRead(item.id);
        else if (item.kind === "message") await markAccountabilityMessageRead(item.id);
        refresh();
    }

    async function clearAll() {
        try {
            await clearAccountabilityInbox();
            setItems([]);
            setDrafts({});
            setUnread(0);
            onUnreadChange?.(0);
        } catch (err) {
            setError(err.message || "Could not clear notifications.");
        }
    }

    async function reply(attemptItem, payload) {
        try {
            await sendAccountabilityMessage(attemptItem.attempt_id, payload);
            setDrafts((value) => ({ ...value, [attemptItem.attempt_id]: "" }));
            if (attemptItem.kind === "attempt") {
                await markAccountabilityNotificationRead(attemptItem.id);
                setItems((current) => current.filter((entry) => entry.id !== attemptItem.id));
                if (!attemptItem.read_at) {
                    setUnread((value) => {
                        const next = Math.max(0, value - 1);
                        onUnreadChange?.(next);
                        return next;
                    });
                }
            }
        } catch (err) { setError(err.message || "Could not send message."); }
    }

    return (
        <div className="tether-screen settings-screen">
            <div className="settings-frame">
                <div className="tether-topbar">
                    <button type="button" className="tether-back" onClick={onBack}>Back</button>
                    <span className="tether-topbar-duration tether-topbar-with-icon">
                        <NotificationBellIcon className="tether-bell-icon" />
                        Notifications
                    </span>
                    {items.length > 0 ? (
                        <button type="button" className="tether-clear-notifications" onClick={clearAll}>
                            Clear all
                        </button>
                    ) : (
                        <span className="tether-topbar-spacer" />
                    )}
                </div>
                <h1 className="settings-title">Accountability inbox</h1>
                {error && <p className="tether-error">{error}</p>}
                <div className="settings-stack">
                    {items.length === 0 && <p className="settings-status">No accountability notifications yet.</p>}
                    {items.map((item) => (
                        <section
                            key={`${item.kind}-${item.id}`}
                            className="settings-card accountability-card"
                            onClick={() => markRead(item)}
                        >
                            {item.kind === "message" ? (
                                <>
                                    <p className="onboarding-section">Encouragement</p>
                                    <h2 className="settings-card-title">{item.body}</h2>
                                    <p className="settings-subtitle">From {item.senderDisplayName || "a friend"}</p>
                                </>
                            ) : (
                                <>
                                    <p className="onboarding-section">{item.read_at ? "Attempt" : "New attempt"}</p>
                                    <h2 className="settings-card-title">
                                        {item.actorDisplayName} opened {item.attempt?.target_label}
                                    </h2>
                                    <p className="settings-subtitle">
                                        {item.attempt?.mode}
                                        {(item.shared_groups || []).length > 0
                                            ? ` · ${(item.shared_groups || []).map((group) => group.name).join(", ")}`
                                            : ""}
                                    </p>
                                    <div className="accountability-presets" role="group" aria-label="Quick replies">
                                        {PRESETS.map(([key, label]) => (
                                            <button
                                                key={key}
                                                type="button"
                                                className="accountability-preset-btn"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    reply(item, { presetKey: key });
                                                }}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="accountability-compose">
                                        <input
                                            value={drafts[item.attempt_id] || ""}
                                            maxLength={280}
                                            placeholder="Write a private message"
                                            onClick={(event) => event.stopPropagation()}
                                            onChange={(event) => setDrafts((value) => ({ ...value, [item.attempt_id]: event.target.value }))}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter" && !event.shiftKey) {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    const body = (drafts[item.attempt_id] || "").trim();
                                                    if (body) reply(item, { body });
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="accountability-send-btn"
                                            disabled={!(drafts[item.attempt_id] || "").trim()}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                reply(item, { body: drafts[item.attempt_id] || "" });
                                            }}
                                        >
                                            Send
                                        </button>
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
