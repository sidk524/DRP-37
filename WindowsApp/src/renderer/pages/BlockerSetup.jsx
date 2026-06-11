import "../styles/BlockerSetup.css";
import { useState } from "react";
import DurationScrollPicker from "../components/DurationScrollPicker";
import LockGraphic from "../components/LockGraphic";
import Groups from "./Groups";
import Settings from "./Settings";
import SessionComplete from "./SessionComplete";
import { useBlockerSessionController } from "../hooks/useBlockerSessionController";

const WEBSITE_GROUPS = [
    {
        name: "Social media",
        domains: ["instagram.com", "tiktok.com", "youtube.com", "facebook.com", "x.com", "reddit.com"],
    },
    {
        name: "Messaging",
        domains: ["web.whatsapp.com", "discord.com", "messenger.com", "telegram.org"],
    },
    {
        name: "Streaming",
        domains: ["youtube.com", "netflix.com", "twitch.tv", "primevideo.com"],
    },
];

export function strictnessToMode(strictness) {
    if (strictness === "gentle") return "breathing";
    if (strictness === "moderate") return "reflect";
    if (strictness === "hard") return "hard";
    return "reflect";
}

function formatDurationPill(hours, minutes) {
    if (hours > 0 && minutes === 0) return `${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return "5m";
}

function BlockerSetup({ session, defaultMode = "breathing", onStrictnessChange }) {
    const [view, setView] = useState("duration");
    const {
        websites,
        urlInput,
        urlError,
        hours,
        minutes,
        seconds,
        active,
        sessionError,
        sessionRunning,
        selectedCount,
        setUrlInput,
        setUrlError,
        setHours,
        setMinutes,
        setSeconds,
        addWebsite,
        addPresetWebsite,
        addPresetWebsites,
        removeWebsite,
        clearWebsites,
        handleLockIn,
        handleStopSession,
        handleSignOut,
        handleSettingsSaved,
        lastCompletedSession,
        setLastCompletedSession,
    } = useBlockerSessionController({
        userId: session.user.id,
        defaultMode,
        onStrictnessChange,
    });

    if (view === "settings") {
        return (
            <Settings
                session={session}
                onBack={() => setView("duration")}
                onSaved={(settings) => handleSettingsSaved(settings, strictnessToMode)}
            />
        );
    }

    if (view === "groups") {
        return <Groups onBack={() => setView("duration")} />;
    }

    if (lastCompletedSession) {
        return (
            <SessionComplete
                session={lastCompletedSession}
                onDone={() => {
                    setLastCompletedSession(null);
                    setView("duration");
                }}
            />
        );
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
                    <div className="tether-selection-actions">
                        <button
                            type="button"
                            className="tether-clear-all"
                            onClick={clearWebsites}
                            disabled={sessionRunning || selectedCount === 0}
                        >
                            Clear all
                        </button>
                    </div>

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

                    <div className="tether-presets">
                        <button
                            type="button"
                            className="tether-preset-btn"
                            onClick={() => addPresetWebsite("instagram.com")}
                            disabled={sessionRunning}
                        >
                            Instagram
                        </button>
                        <button
                            type="button"
                            className="tether-preset-btn"
                            onClick={() => addPresetWebsite("tiktok.com")}
                            disabled={sessionRunning}
                        >
                            TikTok
                        </button>
                        <button
                            type="button"
                            className="tether-preset-btn"
                            onClick={() => addPresetWebsite("facebook.com")}
                            disabled={sessionRunning}
                        >
                            Facebook
                        </button>
                        <button
                            type="button"
                            className="tether-preset-btn"
                            onClick={() => addPresetWebsite("youtube.com")}
                            disabled={sessionRunning}
                        >
                            YouTube
                        </button>
                    </div>

                    <div className="tether-groups">
                        <h2 className="tether-groups-title">Quick groups</h2>
                        <div className="tether-group-list">
                            {WEBSITE_GROUPS.map((group) => (
                                <button
                                    key={group.name}
                                    type="button"
                                    className="tether-group-btn"
                                    onClick={() => addPresetWebsites(group.domains)}
                                    disabled={sessionRunning}
                                >
                                    <span>{group.name}</span>
                                    <small>
                                        Add {group.domains.length} website
                                        {group.domains.length === 1 ? "" : "s"}
                                    </small>
                                </button>
                            ))}
                        </div>
                    </div>

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
                <div className="tether-header-actions">
                    <button
                        type="button"
                        className="tether-header-action"
                        onClick={() => setView("groups")}
                    >
                        Groups
                    </button>
                    <button
                        type="button"
                        className="tether-header-action"
                        onClick={() => setView("settings")}
                    >
                        Settings
                    </button>
                    <button type="button" className="tether-header-action" onClick={handleSignOut}>
                        Log out
                    </button>
                </div>

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
            </div>
        </div>
    );
}

export default BlockerSetup;
