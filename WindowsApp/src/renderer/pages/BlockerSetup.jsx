import "../styles/BlockerSetup.css";
import { useEffect, useState } from "react";
import { signOut } from "../services/SupabaseClient";

// Post-auth landing — the Electron equivalent of Android's BlockerSetupScreen.
// Pick apps + mode + duration, then "Start Session" drives the live blocker.
// `tokens` are the lowercase substrings matched against the foreground process
// name. "Notepad (test)" is an easy way to verify blocking on Windows.
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

const DURATIONS = [15, 30, 60, 120];

function formatRemaining(ms) {
    if (ms == null) return "";
    const total = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

function BlockerSetup({ session }) {
    const [selected, setSelected] = useState(() => new Set());
    const [mode, setMode] = useState("breathing");
    const [duration, setDuration] = useState(30);
    const [active, setActive] = useState(null); // active session view from main
    const [now, setNow] = useState(Date.now());

    const email = session?.user?.email || "your account";

    // Track the live session state from the main process.
    useEffect(() => {
        let unsub = () => {};
        if (window.tether?.getSession) {
            window.tether.getSession().then((s) => setActive(s?.active ? s : null));
            unsub = window.tether.onSessionUpdate((s) => setActive(s?.active ? s : null));
        }
        return unsub;
    }, []);

    // Tick once a second to update the countdown while a session is active.
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

    async function handleStart() {
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
            // Session started, but website blocking couldn't be applied
            // (usually: Tether isn't running as administrator).
            alert(`Session started, but websites weren't blocked:\n${res.warning}`);
        }
    }

    async function handleStopSession() {
        const res = await window.tether?.stopSession();
        if (res && !res.ok) alert(res.error); // e.g. a hard session refusing to stop
    }

    async function handleSignOut() {
        await signOut(); // AuthGate reacts and returns to the login screen
    }

    // ── Active session view ──
    if (active) {
        const remaining = active.endsAt ? active.endsAt - now : null;
        const modeLabel = MODES.find((m) => m.id === active.mode)?.label || active.mode;
        return (
            <div className="setup">
                <div className="setup-inner">
                    <div className="setup-topbar">
                        <span className="setup-account">{email}</span>
                        <button className="setup-signout" onClick={handleSignOut}>Sign out</button>
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
                                🔒 Hard session — can't be ended early. Hold tight until the timer runs out.
                            </p>
                        ) : (
                            <button className="setup-stop" onClick={handleStopSession}>
                                End session early
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ── Setup view ──
    return (
        <div className="setup">
            <div className="setup-inner">
                <div className="setup-topbar">
                    <span className="setup-account">{email}</span>
                    <button className="setup-signout" onClick={handleSignOut}>Sign out</button>
                </div>

                <h1 className="setup-title">Block Apps</h1>
                <p className="setup-count">{selected.size} apps selected</p>

                <div className="setup-grid">
                    {CANDIDATE_APPS.map((app) => {
                        const isOn = selected.has(app.name);
                        return (
                            <button
                                key={app.name}
                                className={`setup-app ${isOn ? "on" : ""}`}
                                onClick={() => toggle(app.name)}
                            >
                                <span className="setup-app-dot" />
                                {app.name}
                            </button>
                        );
                    })}
                </div>

                <p className="setup-section-label">Mode</p>
                <div className="setup-modes">
                    {MODES.map((m) => (
                        <button
                            key={m.id}
                            className={`setup-mode ${mode === m.id ? "on" : ""}`}
                            onClick={() => setMode(m.id)}
                        >
                            <span className="setup-mode-label">{m.label}</span>
                            <span className="setup-mode-hint">{m.hint}</span>
                        </button>
                    ))}
                </div>

                <p className="setup-section-label">Duration</p>
                <div className="setup-durations">
                    {DURATIONS.map((d) => (
                        <button
                            key={d}
                            className={`setup-duration ${duration === d ? "on" : ""}`}
                            onClick={() => setDuration(d)}
                        >
                            {d >= 60 ? `${d / 60}h` : `${d}m`}
                        </button>
                    ))}
                </div>

                <button
                    className="setup-start"
                    disabled={selected.size === 0}
                    onClick={handleStart}
                >
                    Start Session · {selected.size} apps
                </button>
            </div>
        </div>
    );
}

export default BlockerSetup;
