import { useEffect, useRef, useState } from "react";
import {
    createSession,
    endSession,
    loadActiveSession,
    patchSessionMode,
} from "../services/BlockSessionRepository";
import {
    listBlockGroups,
    loadLastBlockGroupId,
    saveLastBlockGroupId,
} from "../services/BlockGroupRepository";
import { getUserTotalPoints, loadOnboarding, signOut } from "../services/SupabaseClient";
import {
    getTetherSession,
    isTetherBridgeAvailable,
    onRemoteSessionSync,
    onTetherSessionUpdate,
    startTetherSession,
    stopTetherSession,
    updateTetherSession,
} from "../services/TetherClient";

const SESSION_MODES = ["breathing", "reflect", "hard"];

function normalizeMode(mode, fallback = "reflect") {
    return SESSION_MODES.includes(mode) ? mode : fallback;
}

function normalizeWebsite(input) {
    let value = input.trim().toLowerCase();
    if (!value) return null;
    value = value.replace(/^https?:\/\//, "");
    value = value.split("/")[0].split("?")[0];
    value = value.replace(/^(www|m|mobile)\./, "");
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
    const [blockGroups, setBlockGroups] = useState([]);
    const [blockGroupsLoading, setBlockGroupsLoading] = useState(true);
    const [blockGroupsError, setBlockGroupsError] = useState("");
    const [selectedBlockGroupId, setSelectedBlockGroupId] = useState(null);
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
    const [lastCompletedSession, setLastCompletedSession] = useState(null);
    const wasActiveRef = useRef(false);
    const lastAwardedEndedAtRef = useRef(null);
    const restoredSessionRef = useRef(false);

    function setCurrentActiveSession(session) {
        setNow(Date.now());
        setActive(session);
    }

    const sessionRunning = !!active;
    const selectedBlockGroup = blockGroups.find((group) => group.id === selectedBlockGroupId) || null;
    const totalSeconds = Math.max(5, hours * 3600 + minutes * 60 + seconds);

    useEffect(() => {
        setMode(defaultMode);
    }, [defaultMode]);

    async function refreshBlockGroups() {
        setBlockGroupsError("");
        try {
            const groups = await listBlockGroups();
            setBlockGroups(groups);
            setSelectedBlockGroupId((current) => {
                if (current && groups.some((group) => group.id === current)) return current;
                const lastId = loadLastBlockGroupId();
                if (lastId && groups.some((group) => group.id === lastId)) return lastId;
                return groups[0]?.id || null;
            });
            return groups;
        } catch (error) {
            console.error("Failed to load block groups:", error);
            setBlockGroupsError(error.message || "Could not load block groups.");
            return [];
        } finally {
            setBlockGroupsLoading(false);
        }
    }

    useEffect(() => {
        refreshBlockGroups();
    }, [userId]);

    function selectBlockGroup(groupId) {
        if (sessionRunning) return;
        setSelectedBlockGroupId(groupId);
        saveLastBlockGroupId(groupId);
    }

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

    function resolveBlockGroupName(serverSession, groups = blockGroups) {
        const fromServer = String(serverSession?.block_group_name || "").trim();
        if (fromServer) return fromServer;

        const groupId = serverSession?.block_group_id || selectedBlockGroupId;
        if (!groupId) return null;

        const normalizedId = String(groupId);
        const matched = groups.find((group) => String(group.id) === normalizedId);
        if (matched?.name) return matched.name;

        if (
            selectedBlockGroup
            && String(selectedBlockGroup.id) === normalizedId
            && selectedBlockGroup.name
        ) {
            return selectedBlockGroup.name;
        }

        return null;
    }

    async function startLocalSession(serverSession, groups = blockGroups, modeOverride = null) {
        const endsAt = sessionEndsAt(serverSession);
        if (endsAt <= Date.now()) return null;

        const blockGroupId = serverSession.block_group_id || selectedBlockGroupId || null;
        if (blockGroupId) {
            setSelectedBlockGroupId(blockGroupId);
        }
        setRemoteSessionId(serverSession.id);
        const friction = await loadFrictionContext();
        const blockGroupName = resolveBlockGroupName(serverSession, groups)
            || (selectedBlockGroup?.name && String(selectedBlockGroup.id) === String(blockGroupId)
                ? selectedBlockGroup.name
                : null);
        // The server row carries the authoritative mode once it is set; fall back
        // to the local UI mode for older payloads.
        const sessionMode = normalizeMode(modeOverride || serverSession.mode, mode);
        if (sessionMode !== mode) setMode(sessionMode);

        const res = await startTetherSession({
            sessionId: serverSession.id,
            blockGroupId,
            blockGroupName,
            appLabels: sessionLabels(serverSession),
            domains: serverSession.domains_blocked || [],
            mode: sessionMode,
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
        if (restoredSessionRef.current || blockGroupsLoading) return;
        restoredSessionRef.current = true;

        loadActiveSession()
            .then(async (serverSession) => {
                if (!serverSession) return;
                const restored = await startLocalSession(serverSession, blockGroups);
                if (restored) {
                    setCurrentActiveSession(restored);
                    wasActiveRef.current = true;
                }
            })
            .catch((error) => {
                setSessionError(error.message || "Could not restore active session.");
            });
    }, [userId, mode, blockGroupsLoading, blockGroups]);

    useEffect(() => {
        if (!isTetherBridgeAvailable()) {
            setSessionError("Desktop bridge is unavailable. Open the app in Electron to run focus sessions.");
            return () => {};
        }

        getTetherSession()
            .then((s) => {
                const isActive = !!s?.active;
                setCurrentActiveSession(isActive ? s : null);
                // We do NOT update wasActiveRef here to avoid missing the transition
                // if getTetherSession returns the same state as the first listener update.
                // In 4d07ff8c, wasActiveRef was only updated in the listener.
            })
            .catch((error) => {
                console.error("Failed to get current focus session:", error);
                setSessionError("Could not load current focus session.");
            });

        return onTetherSessionUpdate(async (s) => {
            const wasActive = wasActiveRef.current;
            const isActive = !!s?.active;
            const reason = s?.lastStop?.reason;
            const endedAt = s?.lastStop?.endedAt;

            if (wasActive && !isActive && endedAt && endedAt !== lastAwardedEndedAtRef.current) {
                try {
                    if (reason === "expired" && remoteSessionId) {
                        // Server computes + awards points once and returns the record.
                        const { completed } = await endSession(remoteSessionId, "expired");
                        setRemoteSessionId(null);
                        if (completed) {
                            setLastCompletedSession(completed);
                            await refreshPoints();
                        }
                    } else if (reason === "manual" && remoteSessionId) {
                        await endSession(remoteSessionId, "manual");
                        setRemoteSessionId(null);
                    }
                    // reason === "remote": the server already closed the session and
                    // applyRemoteSync handled any completion summary — nothing to do.
                    lastAwardedEndedAtRef.current = endedAt;
                } catch (error) {
                    console.error("Failed to close focus session:", error);
                }
            }

            wasActiveRef.current = isActive;
            setCurrentActiveSession(isActive ? s : null);
        });
    }, [remoteSessionId, userId]);

    // Apply real-time updates pushed from the web server (other device started,
    // stopped, or changed the mode). The server already excludes this device's
    // own changes, so anything received here is a genuine remote event.
    // We keep the handler in a ref so the subscription stays mounted once while
    // always reading the latest session state.
    const applyRemoteSyncRef = useRef(null);
    applyRemoteSyncRef.current = async (message) => {
        const serverSession = message?.session || null;

        if (!serverSession) {
            const completed = message?.completed || null;
            if (!sessionRunning && !active) {
                // Already idle, but still surface a completion the other device
                // earned (e.g. it expired while we were on the setup screen).
                if (completed) {
                    setLastCompletedSession(completed);
                    await refreshPoints();
                }
                return;
            }
            setRemoteSessionId(null);
            const res = await stopTetherSession({ reason: "remote" });
            if (res && !res.ok) {
                console.error("Failed to apply remote stop:", res.error);
            }
            // If the other device completed the session (expiry), show the same
            // completion screen with the server-awarded points; a manual remote
            // stop carries no record and simply returns to setup.
            if (completed) {
                setLastCompletedSession(completed);
                await refreshPoints();
            }
            return;
        }

        const serverMode = normalizeMode(serverSession.mode, mode);
        const isSameSession = active?.sessionId
            && String(active.sessionId) === String(serverSession.id);

        if (isSameSession) {
            if (serverMode !== active.mode) {
                setMode(serverMode);
                const res = await updateTetherSession({ mode: serverMode });
                if (res && !res.ok) {
                    console.error("Failed to apply remote mode change:", res.error);
                }
            }
            return;
        }

        try {
            const localSession = await startLocalSession(serverSession, blockGroups, serverMode);
            if (localSession) {
                setCurrentActiveSession(localSession);
                wasActiveRef.current = true;
            }
        } catch (error) {
            setSessionError(error.message || "Could not apply remote session.");
        }
    };

    useEffect(() => {
        return onRemoteSessionSync((message) => {
            applyRemoteSyncRef.current?.(message);
        });
    }, []);

    useEffect(() => {
        if (!active?.active || !active.blockGroupId || active.blockGroupName) return;
        const name = resolveBlockGroupName({ block_group_id: active.blockGroupId }, blockGroups);
        if (!name) return;

        updateTetherSession({
            blockGroupId: active.blockGroupId,
            blockGroupName: name,
        }).catch((error) => {
            console.error("Failed to backfill block group name:", error);
        });
    }, [active?.active, active?.blockGroupId, active?.blockGroupName, blockGroups]);

    useEffect(() => {
        if (!active?.endsAt) return;

        const tick = () => setNow(Date.now());
        tick();

        const id = setInterval(tick, 1000);
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

    async function handleLockIn() {
        if (!selectedBlockGroupId) return;
        setSessionError("");
        try {
            const serverSession = await createSession({
                blockGroupId: selectedBlockGroupId,
                totalDurationSeconds: totalSeconds,
                mode,
            });
            saveLastBlockGroupId(selectedBlockGroupId);
            const localSession = await startLocalSession(serverSession);
            if (localSession) {
                setCurrentActiveSession(localSession);
                wasActiveRef.current = true;
            }
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
            await endSession(remoteSessionId, "manual");
            setRemoteSessionId(null);
        }
    }

    async function handleSignOut() {
        if (remoteSessionId) {
            await endSession(remoteSessionId, "manual");
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
            // Propagate the mode change to the server so other devices sync.
            try {
                await patchSessionMode(nextMode);
            } catch (error) {
                console.error("Failed to sync mode to server:", error);
            }
        }
    }

    return {
        blockGroups,
        blockGroupsLoading,
        blockGroupsError,
        selectedBlockGroupId,
        selectedBlockGroup,
        hours,
        minutes,
        seconds,
        active,
        points,
        sessionError,
        sessionRunning,
        lastCompletedSession,
        setHours,
        setMinutes,
        setSeconds,
        selectBlockGroup,
        refreshBlockGroups,
        handleLockIn,
        handleStopSession,
        handleSignOut,
        handleSettingsSaved,
        setLastCompletedSession,
    };
}

export { normalizeWebsite, displayDomains };
