import "../styles/BlockerSetup.css";
import { useEffect, useRef, useState } from "react";
import DurationScrollPicker from "../components/DurationScrollPicker";
import LockGraphic from "../components/LockGraphic";
import {
    createSession,
    endSession,
    loadActiveSession,
} from "../services/BlockSessionRepository";
import { getUserTotalPoints, saveSessionPoints, signOut } from "../services/SupabaseClient";

export function strictnessToMode(strictness) {
    if (strictness === "gentle") return "breathing";
    if (strictness === "moderate") return "reflect";
    if (strictness === "strict") return "hard";
    return "breathing";
}

function normalizeWebsite(input) {
    let value = input.trim().toLowerCase();
    if (!value) return null;
    value = value.replace(/^https?:\/\//, "").replace(/^www\./, "");
    value = value.split("/")[0].split("?")[0];
    if (!value || !value.includes(".")) return null;
    return value;
}

function formatDurationPill(hours, minutes) {
    if (hours > 0 && minutes === 0) return `${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return "5m";
}

function displayDomains(domains = []) {
    return Array.from(
        new Set(
            domains
                .map(normalizeWebsite)
                .filter(Boolean)
        )
    ).sort();
}

function sessionLabels(serverSession) {
    if (serverSession?.canonical_targets?.length) return serverSession.canonical_targets;
    if (serverSession?.domains_blocked?.length) return displayDomains(serverSession.domains_blocked);
    return [];
}

function sessionDurationMinutes(serverSession) {
    return Math.max(1, Math.ceil((serverSession?.total_duration_seconds || 60) / 60));
}

function sessionStartedAt(serverSession) {
    return Date.parse(serverSession?.started_at || "") || Date.now();
}

function sessionEndsAt(serverSession) {
    return sessionStartedAt(serverSession) + (serverSession?.total_duration_seconds || 60) * 1000;
}

function BlockerSetup({ session, defaultMode = "breathing" }) {
    const [view, setView] = useState("duration");
    const [websites, setWebsites] = useState([]);
    const [urlInput, setUrlInput] = useState("");
    const [urlError, setUrlError] = useState("");
    const [hours, setHours] = useState(0);
    const [minutes, setMinutes] = useState(30);
    const [seconds, setSeconds] = useState(0);
    const [mode, setMode] = useState(defaultMode);
    const [active, setActive] = useState(null);
    const [now, setNow] = useState(Date.now());
    const [points, setPoints] = useState(0);
    const [sessionError, setSessionError] = useState("");
    const [remoteSessionId, setRemoteSessionId] = useState(null);
    const wasActiveRef = useRef(false);
    const lastAwardedEndedAtRef = useRef(null);
    const restoredSessionRef = useRef(false);

    const sessionRunning = !!active;
    const selectedCount = websites.length;
    const totalSeconds = Math.max(5, hours * 3600 + minutes * 60 + seconds);
    const durationMinutes = Math.max(1, Math.ceil(totalSeconds / 60));

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

    async function startLocalSession(serverSession) {
        const endsAt = sessionEndsAt(serverSession);
        if (endsAt <= Date.now()) return null;

        const selectedDomains = displayDomains(serverSession.domains_blocked);
        setWebsites(selectedDomains);
        setRemoteSessionId(serverSession.id);

        const res = await window.tether?.startSession({
            sessionId: serverSession.id,
            appLabels: sessionLabels(serverSession),
            domains: serverSession.domains_blocked || [],
            mode,
            durationMinutes: sessionDurationMinutes(serverSession),
            startedAt: sessionStartedAt(serverSession),
            endsAt,
        });

        if (res && !res.ok) {
            throw new Error(res.error);
        }
        return res?.session || null;
    }

    useEffect(() => {
        refreshPoints();
    }, [session.user.id]);

    useEffect(() => {
        if (restoredSessionRef.current) return;
        restoredSessionRef.current = true;

        loadActiveSession()
            .then(async (serverSession) => {
                if (!serverSession) return;
                const restored = await startLocalSession(serverSession);
                if (restored) setActive(restored);
            })
            .catch((error) => {
                setSessionError(error.message || "Could not restore active session.");
            });
    }, [session.user.id, mode]);

    useEffect(() => {
        let unsub = () => {};
        if (window.tether?.getSession) {
            window.tether.getSession().then((s) => setActive(s?.active ? s : null));
            unsub = window.tether.onSessionUpdate(async (s) => {
                const wasActive = wasActiveRef.current;
                const isActive = !!s?.active;
                const endedByExpiry = s?.lastStop?.reason === "expired";
                const endedAt = s?.lastStop?.endedAt;

                if (wasActive && !isActive && endedAt && endedAt !== lastAwardedEndedAtRef.current) {
                    try {
                        if (endedByExpiry) {
                            await saveSessionPoints({
                                userId: session.user.id,
                                mode: s.lastStop.mode,
                                actualMs: s.lastStop.actualMs,
                                plannedMs: s.lastStop.plannedMs,
                                blockedAppsCount: s.lastStop.blockedAppsCount,
                                endedAt: new Date(endedAt).toISOString(),
                            });
                            await refreshPoints();
                        }
                        if (remoteSessionId) {
                            await endSession(remoteSessionId);
                            setRemoteSessionId(null);
                        }
                        lastAwardedEndedAtRef.current = endedAt;
                    } catch (error) {
                        console.error("Failed to close focus session:", error);
                    }
                }

                wasActiveRef.current = isActive;
                setActive(isActive ? s : null);
            });
        }
        return unsub;
    }, [remoteSessionId, session.user.id]);

    useEffect(() => {
        if (!active?.endsAt) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [active]);

    useEffect(() => {
        if (!active?.endsAt) return;
        const remainingMs = Math.max(0, active.endsAt - now);
        const totalSeconds = Math.floor(remainingMs / 1000);
        setHours(Math.floor(totalSeconds / 3600));
        setMinutes(Math.floor((totalSeconds % 3600) / 60));
        setSeconds(totalSeconds % 60);
    }, [active, now]);

    function addWebsite() {
        const normalized = normalizeWebsite(urlInput);
        if (!normalized) {
            setUrlError("Enter a valid website (e.g. instagram.com)");
            return;
        }
        if (websites.includes(normalized)) {
            setUrlError("That website is already in your list");
            return;
        }
        setWebsites((prev) => [...prev, normalized].sort());
        setUrlInput("");
        setUrlError("");
    }

    function removeWebsite(domain) {
        if (sessionRunning) return;
        setWebsites((prev) => prev.filter((item) => item !== domain));
    }

    async function handleLockIn() {
        if (selectedCount === 0) return;
        setSessionError("");
        try {
            const serverSession = await createSession({
                domainsBlocked: websites,
                totalDurationSeconds: totalSeconds,
            });
            const localSession = await startLocalSession(serverSession);
            if (localSession) setActive(localSession);
        } catch (error) {
            setSessionError(error.message || "Could not start block session.");
        }
    }

    async function handleStopSession() {
        const res = await window.tether?.stopSession();
        if (res && !res.ok) {
            setSessionError(res.error);
            return;
        }
        if (remoteSessionId) {
            await endSession(remoteSessionId);
            setRemoteSessionId(null);
        }
    }

    async function handleSignOut() {
        if (remoteSessionId) {
            await endSession(remoteSessionId);
            setRemoteSessionId(null);
        }
        await window.tether?.stopSession();
        await signOut();
    }

    if (view === "websites") {
        return (
            <div className="tether-screen">
                <div className="tether-frame">
                    <div className="tether-topbar">
                        <button
                            type="button"
                            className="tether-back"
                            onClick={() => setView("duration")}
                        >
                            <span className="tether-back-chevron" aria-hidden />
                            Back
                        </button>
                        <span className="tether-topbar-duration">
                            {formatDurationPill(hours, minutes)}
                        </span>
                        <span className="tether-topbar-spacer" aria-hidden />
                    </div>

                    <h1 className="tether-title">Choose websites</h1>
                    <p className="tether-subtitle-count">
                        {selectedCount} website{selectedCount === 1 ? "" : "s"} selected
                    </p>

                    <div className="tether-url-row">
                        <label className="tether-search">
                            <span className="tether-search-icon" aria-hidden />
                            <input
                                type="text"
                                value={urlInput}
                                onChange={(e) => {
                                    setUrlInput(e.target.value);
                                    setUrlError("");
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addWebsite();
                                    }
                                }}
                                placeholder="e.g. instagram.com"
                                spellCheck={false}
                                disabled={sessionRunning}
                            />
                        </label>
                        <button
                            type="button"
                            className="tether-url-add"
                            onClick={addWebsite}
                            disabled={sessionRunning}
                        >
                            Add
                        </button>
                    </div>

                    {urlError && <p className="tether-error">{urlError}</p>}

                    <ul className="tether-url-list">
                        {websites.length === 0 ? (
                            <li className="tether-url-empty">No websites added yet</li>
                        ) : (
                            websites.map((domain) => (
                                <li key={domain} className="tether-url-item">
                                    <span>{domain}</span>
                                    {!sessionRunning && (
                                        <button
                                            type="button"
                                            className="tether-url-remove"
                                            onClick={() => removeWebsite(domain)}
                                            aria-label={`Remove ${domain}`}
                                        >
                                            ×
                                        </button>
                                    )}
                                </li>
                            ))
                        )}
                    </ul>

                    <button
                        type="button"
                        className="tether-done"
                        onClick={() => setView("duration")}
                    >
                        Done · {selectedCount} website{selectedCount === 1 ? "" : "s"}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="tether-screen tether-screen-duration">
            <div className="tether-frame tether-frame-duration">
                <button type="button" className="tether-logout" onClick={handleSignOut}>
                    Log out
                </button>

                <h1 className="tether-brand">Tether</h1>
                <p className="tether-subtitle">
                    {sessionRunning
                        ? "Session in progress"
                        : "Set a session duration"}
                </p>

                <DurationScrollPicker
                    hours={hours}
                    minutes={minutes}
                    seconds={seconds}
                    onHoursChange={setHours}
                    onMinutesChange={setMinutes}
                    onSecondsChange={setSeconds}
                    locked={sessionRunning}
                />

                <div className="tether-lock-wrap">
                    <LockGraphic locked={sessionRunning} />
                </div>

                <button
                    type="button"
                    className="tether-selected-pill"
                    onClick={() => !sessionRunning && setView("websites")}
                    disabled={sessionRunning}
                >
                    <span className="tether-selected-dot" aria-hidden />
                    <span>
                        Selected Websites · {selectedCount}
                    </span>
                </button>

                {sessionRunning && active?.mode === "hard" ? (
                    <p className="tether-session-hint">
                        Hard session — hold tight until the timer runs out.
                    </p>
                ) : sessionRunning && active?.mode !== "hard" ? (
                    <button type="button" className="tether-end-early" onClick={handleStopSession}>
                        End session early
                    </button>
                ) : null}

                {sessionError && (
                    <p className="tether-error tether-session-error">{sessionError}</p>
                )}

                <button
                    type="button"
                    className="tether-lockin"
                    disabled={sessionRunning || selectedCount === 0}
                    onClick={handleLockIn}
                >
                    {sessionRunning ? "Session Running" : "Lock-In!"}
                </button>

                <p className="tether-points">{points} pts</p>
            </div>
        </div>
    );
}

export default BlockerSetup;
