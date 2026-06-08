import { useEffect, useRef, useState } from "react";
import { createSession, endSession, loadActiveSession } from "../services/BlockSessionRepository";
import { getUserTotalPoints, loadOnboarding, saveSessionPoints, signOut } from "../services/SupabaseClient";
import {
    getTetherSession,
    isTetherBridgeAvailable,
    onTetherSessionUpdate,
    startTetherSession,
    stopTetherSession,
    updateTetherSession,
} from "../services/TetherClient";

function normalizeWebsite(input) {
    let value = input.trim().toLowerCase();
    if (!value) return null;
    value = value.replace(/^https?:\/\//, "").replace(/^www\./, "");
    value = value.split("/")[0].split("?")[0];
    if (!value || !value.includes(".")) return null;
    return value;
}

function displayDomains(domains = []) {
    return Array.from(new Set(domains.map((domain) => normalizeWebsite(domain || "")).filter(Boolean))).sort();
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

export function useBlockerSessionController({ userId, defaultMode, onStrictnessChange }) {
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
    const [onboardingSettings, setOnboardingSettings] = useState(null);
    const wasActiveRef = useRef(false);
    const lastAwardedEndedAtRef = useRef(null);
    const restoredSessionRef = useRef(false);

    const sessionRunning = !!active;
    const selectedCount = websites.length;
    const totalSeconds = Math.max(5, hours * 3600 + minutes * 60 + seconds);

    useEffect(() => {
        setMode(defaultMode);
    }, [defaultMode]);

    async function refreshPoints() {
        try {
            const totalPoints = await getUserTotalPoints(userId);
            setPoints(totalPoints);
        } catch (error) {
            console.error("Failed to load focus points:", error);
        }
    }

    async function loadFrictionContext() {
        const settings = onboardingSettings || await loadOnboarding(userId);
        if (settings) setOnboardingSettings(settings);
        return {
            futureMessage: settings?.futureMessage || "",
            goals: settings?.doMoreOf || [],
        };
    }

    async function startLocalSession(serverSession) {
        const endsAt = sessionEndsAt(serverSession);
        if (endsAt <= Date.now()) return null;

        const selectedDomains = displayDomains(serverSession.domains_blocked);
        setWebsites(selectedDomains);
        setRemoteSessionId(serverSession.id);
        const friction = await loadFrictionContext();

        const res = await startTetherSession({
            sessionId: serverSession.id,
            appLabels: sessionLabels(serverSession),
            domains: serverSession.domains_blocked || [],
            mode,
            friction,
            durationMinutes: sessionDurationMinutes(serverSession),
            startedAt: sessionStartedAt(serverSession),
            endsAt,
        });

        if (res && !res.ok) throw new Error(res.error);
        return res?.session || null;
    }

    useEffect(() => {
        refreshPoints();
    }, [userId]);

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
    }, [userId, mode]);

    useEffect(() => {
        if (!isTetherBridgeAvailable()) {
            setSessionError("Desktop bridge is unavailable. Open the app in Electron to run focus sessions.");
            return () => {};
        }

        getTetherSession()
            .then((s) => setActive(s?.active ? s : null))
            .catch((error) => {
                console.error("Failed to get current focus session:", error);
                setSessionError("Could not load current focus session.");
            });

        return onTetherSessionUpdate(async (s) => {
            const wasActive = wasActiveRef.current;
            const isActive = !!s?.active;
            const endedByExpiry = s?.lastStop?.reason === "expired";
            const endedAt = s?.lastStop?.endedAt;

            if (wasActive && !isActive && endedAt && endedAt !== lastAwardedEndedAtRef.current) {
                try {
                    if (endedByExpiry) {
                        await saveSessionPoints({
                            userId,
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
    }, [remoteSessionId, userId]);

    useEffect(() => {
        if (!active?.endsAt) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [active]);

    useEffect(() => {
        if (!active?.endsAt) return;
        const remainingMs = Math.max(0, active.endsAt - now);
        const remainingSeconds = Math.floor(remainingMs / 1000);
        setHours(Math.floor(remainingSeconds / 3600));
        setMinutes(Math.floor((remainingSeconds % 3600) / 60));
        setSeconds(remainingSeconds % 60);
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
            const serverSession = await createSession({ domainsBlocked: websites, totalDurationSeconds: totalSeconds });
            const localSession = await startLocalSession(serverSession);
            if (localSession) setActive(localSession);
        } catch (error) {
            setSessionError(error.message || "Could not start block session.");
        }
    }

    async function handleStopSession() {
        const res = await stopTetherSession();
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
        await stopTetherSession();
        await signOut();
    }

    async function handleSettingsSaved(settings, strictnessToMode) {
        setOnboardingSettings(settings);
        const nextMode = strictnessToMode(settings.strictness);
        const friction = {
            futureMessage: settings.futureMessage || "",
            goals: settings.doMoreOf || [],
        };
        setMode(nextMode);
        onStrictnessChange?.(settings.strictness);
        if (sessionRunning) {
            const res = await updateTetherSession({ mode: nextMode, friction });
            if (res && !res.ok) {
                setSessionError(res.error || "Could not update active session.");
            }
        }
    }

    return {
        websites,
        urlInput,
        urlError,
        hours,
        minutes,
        seconds,
        active,
        points,
        sessionError,
        sessionRunning,
        selectedCount,
        setUrlInput,
        setUrlError,
        setHours,
        setMinutes,
        setSeconds,
        addWebsite,
        removeWebsite,
        handleLockIn,
        handleStopSession,
        handleSignOut,
        handleSettingsSaved,
    };
}
