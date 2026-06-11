import "../styles/BlockerSetup.css";
import { useState } from "react";
import DurationScrollPicker from "../components/DurationScrollPicker";
import LockGraphic from "../components/LockGraphic";
import Groups from "./Groups";
import Settings from "./Settings";
import SessionComplete from "./SessionComplete";
import { useBlockerSessionController, normalizeWebsite } from "../hooks/useBlockerSessionController";
import { createBlockGroup, deleteBlockGroup, updateBlockGroup } from "../services/BlockGroupRepository";

const PRESET_WEBSITES = [
    { label: "Instagram", domain: "instagram.com" },
    { label: "TikTok", domain: "tiktok.com" },
    { label: "Facebook", domain: "facebook.com" },
    { label: "YouTube", domain: "youtube.com" },
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

function groupEntries(group) {
    return Array.from(new Set([...(group.targets || []), ...(group.domainsBlocked || [])]));
}

function groupWebsiteCount(group) {
    return (group.expandedDomainsBlocked || []).length;
}

function BlockerSetup({ session, defaultMode = "breathing", onStrictnessChange }) {
    const [view, setView] = useState("duration");
    const [editingGroup, setEditingGroup] = useState(null);
    const [editorName, setEditorName] = useState("");
    const [editorEntries, setEditorEntries] = useState([]);
    const [editorError, setEditorError] = useState("");
    const [editorSaving, setEditorSaving] = useState(false);
    const [urlInput, setUrlInput] = useState("");
    const [managerError, setManagerError] = useState("");

    const {
        blockGroups,
        blockGroupsLoading,
        blockGroupsError,
        selectedBlockGroupId,
        selectedBlockGroup,
        hours,
        minutes,
        seconds,
        active,
        sessionError,
        sessionRunning,
        setHours,
        setMinutes,
        setSeconds,
        selectBlockGroup,
        refreshBlockGroups,
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

    function openEditor(group) {
        setEditingGroup(group);
        setEditorName(group?.name || "");
        setEditorEntries(group ? groupEntries(group) : []);
        setEditorError("");
        setUrlInput("");
        setView("editor");
    }

    function addEditorEntry() {
        const normalized = normalizeWebsite(urlInput);
        if (!normalized) {
            setEditorError("Enter a valid website (e.g. instagram.com)");
            return;
        }
        if (editorEntries.includes(normalized)) {
            setEditorError("That website is already in this group");
            return;
        }
        setEditorEntries((prev) => [...prev, normalized].sort());
        setUrlInput("");
        setEditorError("");
    }

    function addPresetEntry(domain) {
        if (editorEntries.includes(domain)) return;
        setEditorEntries((prev) => [...prev, domain].sort());
        setEditorError("");
    }

    function removeEditorEntry(entry) {
        setEditorEntries((prev) => prev.filter((item) => item !== entry));
    }

    async function saveEditor() {
        const name = editorName.trim();
        if (!name) {
            setEditorError("Give this group a name");
            return;
        }
        if (editorEntries.length === 0) {
            setEditorError("Add at least one website");
            return;
        }

        setEditorSaving(true);
        setEditorError("");
        try {
            if (editingGroup?.id) {
                await updateBlockGroup({
                    id: editingGroup.id,
                    name,
                    targets: editorEntries,
                    appsBlocked: editingGroup.appsBlocked || [],
                    domainsBlocked: [],
                });
            } else {
                await createBlockGroup({ name, targets: editorEntries });
            }
            await refreshBlockGroups();
            setView("groupPicker");
        } catch (error) {
            setEditorError(error.message || "Could not save block group.");
        } finally {
            setEditorSaving(false);
        }
    }

    async function handleDeleteGroup(group) {
        setManagerError("");
        try {
            await deleteBlockGroup(group.id);
            await refreshBlockGroups();
        } catch (error) {
            setManagerError(error.message || "Could not delete block group.");
        }
    }

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

    if (view === "editor") {
        return (
            <div className="tether-screen">
                <div className="tether-frame">
                    <div className="tether-topbar">
                        <button
                            type="button"
                            className="tether-back"
                            onClick={() => setView("groupManager")}
                        >
                            <span className="tether-back-chevron" aria-hidden />
                            Back
                        </button>
                        <span className="tether-topbar-spacer" aria-hidden />
                    </div>

                    <h1 className="tether-title">
                        {editingGroup?.id ? "Edit block group" : "New block group"}
                    </h1>

                    <div className="tether-url-row">
                        <label className="tether-search">
                            <input
                                type="text"
                                value={editorName}
                                onChange={(e) => {
                                    setEditorName(e.target.value);
                                    setEditorError("");
                                }}
                                placeholder="Group name"
                                spellCheck={false}
                                maxLength={80}
                            />
                        </label>
                    </div>

                    <div className="tether-url-row">
                        <label className="tether-search">
                            <span className="tether-search-icon" aria-hidden />
                            <input
                                type="text"
                                value={urlInput}
                                onChange={(e) => {
                                    setUrlInput(e.target.value);
                                    setEditorError("");
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addEditorEntry();
                                    }
                                }}
                                placeholder="e.g. instagram.com"
                                spellCheck={false}
                            />
                        </label>
                        <button type="button" className="tether-url-add" onClick={addEditorEntry}>
                            Add
                        </button>
                    </div>

                    {editorError && <p className="tether-error">{editorError}</p>}

                    <div className="tether-presets">
                        {PRESET_WEBSITES.map((preset) => (
                            <button
                                key={preset.domain}
                                type="button"
                                className="tether-preset-btn"
                                onClick={() => addPresetEntry(preset.domain)}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    <ul className="tether-url-list">
                        {editorEntries.length === 0 ? (
                            <li className="tether-url-empty">No websites added yet</li>
                        ) : (
                            editorEntries.map((entry) => (
                                <li key={entry} className="tether-url-item">
                                    <span>{entry}</span>
                                    <button
                                        type="button"
                                        className="tether-url-remove"
                                        onClick={() => removeEditorEntry(entry)}
                                        aria-label={`Remove ${entry}`}
                                    >
                                        ×
                                    </button>
                                </li>
                            ))
                        )}
                    </ul>

                    <button
                        type="button"
                        className="tether-done"
                        onClick={saveEditor}
                        disabled={editorSaving}
                    >
                        {editorSaving ? "Saving…" : "Save group"}
                    </button>
                </div>
            </div>
        );
    }

    if (view === "groupManager") {
        return (
            <div className="tether-screen">
                <div className="tether-frame">
                    <div className="tether-topbar">
                        <button
                            type="button"
                            className="tether-back"
                            onClick={() => setView("groupPicker")}
                        >
                            <span className="tether-back-chevron" aria-hidden />
                            Back
                        </button>
                        <span className="tether-topbar-spacer" aria-hidden />
                    </div>

                    <h1 className="tether-title">Manage block groups</h1>

                    {managerError && <p className="tether-error">{managerError}</p>}

                    <div className="tether-groups">
                        <div className="tether-group-list">
                            {blockGroups.map((group) => (
                                <div key={group.id} className="tether-url-item">
                                    <span>
                                        {group.name}
                                        {group.systemKey ? " · default" : ""}
                                    </span>
                                    <span>
                                        <button
                                            type="button"
                                            className="tether-header-action"
                                            onClick={() => openEditor(group)}
                                        >
                                            Edit
                                        </button>
                                        {!group.systemKey && (
                                            <button
                                                type="button"
                                                className="tether-url-remove"
                                                onClick={() => handleDeleteGroup(group)}
                                                aria-label={`Delete ${group.name}`}
                                            >
                                                ×
                                            </button>
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button type="button" className="tether-done" onClick={() => openEditor(null)}>
                        New block group
                    </button>
                </div>
            </div>
        );
    }

    if (view === "groupPicker") {
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

                    <h1 className="tether-title">Choose a block group</h1>

                    {blockGroupsError && <p className="tether-error">{blockGroupsError}</p>}

                    <div className="tether-groups">
                        <div className="tether-group-list">
                            {blockGroupsLoading ? (
                                <p className="tether-url-empty">Loading block groups…</p>
                            ) : (
                                blockGroups.map((group) => (
                                    <button
                                        key={group.id}
                                        type="button"
                                        className="tether-group-btn"
                                        onClick={() => {
                                            selectBlockGroup(group.id);
                                            setView("duration");
                                        }}
                                        disabled={sessionRunning}
                                    >
                                        <span>
                                            {group.id === selectedBlockGroupId ? "✓ " : ""}
                                            {group.name}
                                        </span>
                                        <small>
                                            {groupWebsiteCount(group)} website
                                            {groupWebsiteCount(group) === 1 ? "" : "s"}
                                        </small>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        className="tether-done"
                        onClick={() => setView("groupManager")}
                    >
                        Manage groups
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
                    onClick={() => !sessionRunning && setView("groupPicker")}
                    disabled={sessionRunning}
                >
                    <span className="tether-selected-dot" aria-hidden />
                    <span>
                        {selectedBlockGroup
                            ? `Block group · ${selectedBlockGroup.name}`
                            : "Choose a block group"}
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
                    disabled={sessionRunning || !selectedBlockGroupId}
                    onClick={handleLockIn}
                >
                    {sessionRunning ? "Session Running" : "Lock-In!"}
                </button>
            </div>
        </div>
    );
}

export default BlockerSetup;
