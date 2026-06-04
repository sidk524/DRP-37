import "../styles/BlockerSetup.css";
import { useEffect, useMemo, useRef, useState } from "react";
import DurationScrollPicker from "../components/DurationScrollPicker";
import { getUserTotalPoints, saveSessionPoints, signOut } from "../services/SupabaseClient";

const CANDIDATE_APPS = [
    { name: "Instagram", tokens: ["instagram"], domains: ["instagram.com", "www.instagram.com"] },
    { name: "TikTok", tokens: ["tiktok"], domains: ["tiktok.com"] },
    { name: "YouTube", tokens: ["youtube"], domains: ["youtube.com", "www.youtube.com"] },
    { name: "X (Twitter)", tokens: ["twitter", "tweetdeck"], domains: ["twitter.com", "x.com"] },
    { name: "Reddit", tokens: ["reddit"], domains: ["reddit.com"] },
    { name: "Facebook", tokens: ["facebook"], domains: ["facebook.com"] },
    { name: "Notepad (test)", tokens: ["notepad"], domains: [] },
];

const MODES = [
    { id: "breathing", label: "Breathing", hint: "Pause, then through" },
    { id: "reflect", label: "Reflect", hint: "Purpose + your note" },
    { id: "hard", label: "Hard block", hint: "No way through" },
];

export function strictnessToMode(strictness) {
    if (strictness === "gentle") return "breathing";
    if (strictness === "moderate") return "reflect";
    if (strictness === "strict") return "hard";
    return "breathing";
}

function formatRemaining(ms) {
    if (ms == null) return "";
    const total = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

function filterApps(apps, query) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return apps;

    return apps
        .map((app) => {
            const label = app.name.toLowerCase();
            const compactLabel = label.replace(/\s/g, "");
            const compactQuery = normalizedQuery.replace(/\s/g, "");
            const score =
                label === normalizedQuery
                    ? 0
                    : label.startsWith(normalizedQuery)
                      ? 1
                      : compactLabel.startsWith(compactQuery)
                        ? 2
                        : label.includes(normalizedQuery)
                          ? 3
                          : compactLabel.includes(compactQuery)
                            ? 4
                            : 100;
            return { app, score };
        })
        .filter(({ score }) => score < 100)
        .sort((a, b) => a.score - b.score || a.app.name.localeCompare(b.app.name))
        .map(({ app }) => app);
}

function BlockerSetup({ session, defaultMode = "breathing" }) {
    const [view, setView] = useState("session");
    const [selected, setSelected] = useState(() => new Set());
    const [query, setQuery] = useState("");
    const [mode, setMode] = useState(defaultMode);
    const [duration, setDuration] = useState(30);
    const [active, setActive] = useState(null);
    const [now, setNow] = useState(Date.now());
    const [points, setPoints] = useState(0);
    const wasActiveRef = useRef(false);
    const lastAwardedEndedAtRef = useRef(null);

    const email = session?.user?.email || "your account";
    const visibleApps = useMemo(() => filterApps(CANDIDATE_APPS, query), [query]);
    const selectedCount = selected.size;
    const canLockIn = selectedCount > 0;

    useEffect(() => {
        setMode(defaultMode);
    }, [defaultMode]);

    async function refreshPoints() {
        try {
            const totalPoints = await getUserTotalPoints(session.user.id);
            setPoints(totalPoints);
        } catch (error) {
            console.error("Failed to load focus points:", error);
        }
    }

    useEffect(() => {
        refreshPoints();
    }, [session.user.id]);

    useEffect(() => {
        let unsub = () => {};
        if (window.tether?.getSession) {
            window.tether.getSession().then((s) => setActive(s?.active ? s : null));
            unsub = window.tether.onSessionUpdate(async (s) => {
                const wasActive = wasActiveRef.current;
                const isActive = !!s?.active;
                const endedByExpiry = s?.lastStop?.reason === "expired";
                const endedAt = s?.lastStop?.endedAt;

                if (wasActive && !isActive && endedByExpiry && endedAt && endedAt !== lastAwardedEndedAtRef.current) {
                    try {
                        await saveSessionPoints({
                            userId: session.user.id,
                            mode: s.lastStop.mode,
                            actualMs: s.lastStop.actualMs,
                            plannedMs: s.lastStop.plannedMs,
                            blockedAppsCount: s.lastStop.blockedAppsCount,
                            endedAt: new Date(endedAt).toISOString(),
                        });
                        await refreshPoints();
                        lastAwardedEndedAtRef.current = endedAt;
                    } catch (error) {
                        console.error("Failed to save focus points:", error);
                    }
                }

                wasActiveRef.current = isActive;
                setActive(isActive ? s : null);
            });
        }
        return unsub;
    }, [session.user.id]);

    useEffect(() => {
        if (!active) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [active]);

    function toggle(name) {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(name) ? next.delete(name) : next.add(name);
            return next;
        });
    }

    async function handleLockIn() {
        const chosen = CANDIDATE_APPS.filter((a) => selected.has(a.name));
        const apps = chosen.flatMap((a) => a.tokens);
        const appLabels = chosen.map((a) => a.name);
        const domains = chosen.flatMap((a) => a.domains || []);
        const res = await window.tether?.startSession({
            apps,
            appLabels,
            domains,
            mode,
            durationMinutes: duration,
        });
        if (res && !res.ok) {
            alert(res.error);
        } else if (res?.warning) {
            alert(`Session started, but websites weren't blocked:\n${res.warning}`);
        }
    }

    async function handleStopSession() {
        const res = await window.tether?.stopSession();
        if (res && !res.ok) alert(res.error);
    }

    async function handleSignOut() {
        await signOut();
    }

    if (active) {
        const remaining = active.endsAt ? active.endsAt - now : null;
        const modeLabel = MODES.find((m) => m.id === active.mode)?.label || active.mode;
        return (
            <div className="session-shell">
                <div className="session-inner">
                    <div className="session-header">
                        <span className="session-account">{email} · {points} pts</span>
                        <button type="button" className="session-signout" onClick={handleSignOut}>
                            Sign out
                        </button>
                    </div>

                    <div className="session-active">
                        <span className="session-badge">Session active</span>
                        <div className="session-timer">{formatRemaining(remaining)}</div>
                        <p className="session-meta">
                            {modeLabel} · blocking {active.appLabels?.length || 0} app
                            {(active.appLabels?.length || 0) === 1 ? "" : "s"}
                        </p>
                        <div className="session-apps">
                            {(active.appLabels || []).map((a) => (
                                <span key={a} className="session-app-tag">{a}</span>
                            ))}
                        </div>
                        {active.mode === "hard" ? (
                            <p className="session-locked">
                                Hard session — can&apos;t be ended early. Hold tight until the timer runs out.
                            </p>
                        ) : (
                            <button type="button" className="session-stop" onClick={handleStopSession}>
                                End session early
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (view === "apps") {
        return (
            <div className="blocker">
                <div className="blocker-frame">
                    <div className="blocker-topbar">
                        <button type="button" className="blocker-back" onClick={() => setView("session")}>
                            <span className="blocker-back-chevron" aria-hidden />
                            Back
                        </button>
                    </div>

                    <h1 className="blocker-title">Block Apps</h1>
                    <p className="blocker-count">{selectedCount} apps selected</p>

                    <label className="blocker-search">
                        <span className="blocker-search-icon" aria-hidden />
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search"
                            spellCheck={false}
                        />
                    </label>

                    <div className="blocker-grid">
                        {visibleApps.map((app) => {
                            const isOn = selected.has(app.name);
                            return (
                                <button
                                    key={app.name}
                                    type="button"
                                    className={`blocker-app ${isOn ? "on" : ""}`}
                                    onClick={() => toggle(app.name)}
                                >
                                    <span className="blocker-app-icon-wrap">
                                        <span className="blocker-app-icon">{app.name.charAt(0)}</span>
                                        {isOn && (
                                            <span className="blocker-app-check" aria-hidden>
                                                <svg viewBox="0 0 24 24" width="14" height="14">
                                                    <path
                                                        d="M6 12.5 L10 16.5 L18 8"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    />
                                                </svg>
                                            </span>
                                        )}
                                    </span>
                                    <span className="blocker-app-label">{app.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="session-shell">
            <div className="session-inner">
                <div className="session-header">
                    <span className="session-account">{email} · {points} pts</span>
                    <button type="button" className="session-signout" onClick={handleSignOut}>
                        Sign out
                    </button>
                </div>

                <h1 className="session-heading">Start session</h1>
                <p className="session-subheading">Set your focus time, pick apps, then lock in.</p>

                <p className="session-section-label">Duration</p>
                <DurationScrollPicker
                    durationMinutes={duration}
                    onDurationChange={setDuration}
                />

                <p className="session-section-label">Mode</p>
                <div className="session-modes">
                    {MODES.map((m) => (
                        <button
                            key={m.id}
                            type="button"
                            className={`session-mode ${mode === m.id ? "on" : ""}`}
                            onClick={() => setMode(m.id)}
                        >
                            <span className="session-mode-label">{m.label}</span>
                            <span className="session-mode-hint">{m.hint}</span>
                        </button>
                    ))}
                </div>

                <p className="session-section-label">Apps</p>
                <button type="button" className="session-select-apps" onClick={() => setView("apps")}>
                    <span className="session-select-apps-text">
                        <span className="session-select-apps-title">Select apps to block</span>
                        <span className="session-select-apps-sub">
                            {selectedCount === 0
                                ? "No apps selected yet"
                                : `${selectedCount} app${selectedCount === 1 ? "" : "s"} selected`}
                        </span>
                    </span>
                    <span className="session-select-apps-chevron" aria-hidden>›</span>
                </button>

                <button
                    type="button"
                    className="session-lockin"
                    disabled={!canLockIn}
                    onClick={handleLockIn}
                >
                    {canLockIn ? `Lock in · ${selectedCount} apps` : "Select apps to lock in"}
                </button>
            </div>
        </div>
    );
}

export default BlockerSetup;
