import { useEffect, useRef, useState } from "react";
import DurationWheel from "./DurationWheel";
import useCssVarNumber from "../hooks/useCssVarNumber";
import "../styles/DurationScrollPicker.css";

const MAX_HOURS = 23;
const MAX_MINUTES = 59;
const MAX_SECONDS = 59;
const TYPED_DURATION_ERROR_TEXT = "Use HH:MM:SS, MM:SS, or 1h 30m";
const TYPED_DURATION_PLACEHOLDER = "e.g. 00:25:00 or 25m";
const TYPED_DURATION_HINT = "HH:MM:SS, MM:SS, or 1h 30m";

function formatDuration(hours, minutes, seconds) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function normalizeDurationUnits({ hours, minutes, seconds }) {
    const normalizedMinutes = minutes + Math.floor(seconds / 60);
    const normalizedSeconds = seconds % 60;
    const normalizedHours = hours + Math.floor(normalizedMinutes / 60);

    return {
        hours: normalizedHours,
        minutes: normalizedMinutes % 60,
        seconds: normalizedSeconds,
    };
}

function isDurationInRange({ hours, minutes, seconds }) {
    return (
        hours >= 0 &&
        hours <= MAX_HOURS &&
        minutes >= 0 &&
        minutes <= MAX_MINUTES &&
        seconds >= 0 &&
        seconds <= MAX_SECONDS
    );
}

function parseUnitBasedDuration(value) {
    if (!/^[\dhms\s]+$/i.test(value) || !/[hms]/i.test(value)) return null;

    const matches = value.matchAll(/(\d+)\s*([hms])/gi);
    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    for (const match of matches) {
        const amount = Number(match[1]);
        const unit = match[2].toLowerCase();
        if (unit === "h") hours += amount;
        if (unit === "m") minutes += amount;
        if (unit === "s") seconds += amount;
    }

    const normalized = normalizeDurationUnits({ hours, minutes, seconds });
    return isDurationInRange(normalized) ? normalized : null;
}

function parseColonDuration(value) {
    const segments = value.split(":").map((part) => part.trim());
    if (segments.length === 0 || segments.length > 3) return null;
    if (segments.some((part) => !/^\d+$/.test(part))) return null;

    const segmentValues = segments.map((part) => Number(part));
    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    if (segmentValues.length === 3) {
        [hours, minutes, seconds] = segmentValues;
    } else if (segmentValues.length === 2) {
        [minutes, seconds] = segmentValues;
    } else {
        [minutes] = segmentValues;
    }

    const normalized = normalizeDurationUnits({ hours, minutes, seconds });
    return isDurationInRange(normalized) ? normalized : null;
}

function DurationScrollPicker({
    hours,
    minutes,
    seconds,
    onHoursChange,
    onMinutesChange,
    onSecondsChange,
    locked = false,
}) {
    const rowHeight = useCssVarNumber("--duration-row-height", 56);
    const [editing, setEditing] = useState(false);
    const [typedDuration, setTypedDuration] = useState("");
    const [typedError, setTypedError] = useState("");
    const inputRef = useRef(null);

    useEffect(() => {
        if (editing) return;
        setTypedDuration(formatDuration(hours, minutes, seconds));
    }, [editing, hours, minutes, seconds]);

    useEffect(() => {
        if (!editing) return;
        inputRef.current?.focus();
        inputRef.current?.select();
    }, [editing]);

    function parseTypedDuration(value) {
        const normalized = value.trim();
        if (!normalized) return null;

        return parseUnitBasedDuration(normalized) ?? parseColonDuration(normalized);
    }

    function applyTypedDuration() {
        const parsed = parseTypedDuration(typedDuration);
        if (!parsed) {
            setTypedError(TYPED_DURATION_ERROR_TEXT);
            return;
        }

        setTypedError("");
        onHoursChange(parsed.hours);
        onMinutesChange(parsed.minutes);
        onSecondsChange(parsed.seconds);
        setEditing(false);
    }

    function cancelTypedDuration() {
        setTypedError("");
        setEditing(false);
    }

    function handleStartEditing() {
        if (locked) return;
        setTypedError("");
        setEditing(true);
    }

    function handleInputChange(event) {
        setTypedDuration(event.target.value);
        if (typedError) setTypedError("");
    }

    function handleInputKeyDown(event) {
        if (event.key === "Enter") {
            applyTypedDuration();
        }
        if (event.key === "Escape") {
            cancelTypedDuration();
        }
    }

    const wheelConfigs = [
        { id: "hours", value: hours, max: MAX_HOURS, onChange: onHoursChange },
        { id: "minutes", value: minutes, max: MAX_MINUTES, onChange: onMinutesChange },
        { id: "seconds", value: seconds, max: MAX_SECONDS, onChange: onSecondsChange },
    ];

    return (
        <div className="duration-picker">
            <div
                className={`duration-picker-frame ${editing ? "editing" : ""}`}
                onDoubleClick={handleStartEditing}
            >
                {!locked && !editing ? (
                    <div className="duration-picker-type-target" aria-hidden />
                ) : (
                    <div className="duration-picker-highlight" aria-hidden />
                )}
                <div className="duration-picker-wheels">
                    {wheelConfigs.map((config) => (
                        <DurationWheel
                            key={config.id}
                            value={config.value}
                            min={0}
                            max={config.max}
                            locked={locked}
                            rowHeight={rowHeight}
                            onChange={config.onChange}
                        />
                    ))}
                </div>
                <div className="duration-picker-labels">
                    <span>hours</span>
                    <span>min</span>
                    <span>sec</span>
                </div>
                {editing && (
                    <div className="duration-picker-edit-overlay">
                        <div className="duration-picker-edit-panel">
                            <input
                                ref={inputRef}
                                className="duration-picker-edit-input"
                                type="text"
                                value={typedDuration}
                                onChange={handleInputChange}
                                onBlur={applyTypedDuration}
                                onKeyDown={handleInputKeyDown}
                                placeholder={TYPED_DURATION_PLACEHOLDER}
                                aria-label="Type duration"
                            />
                            <p className="duration-picker-edit-hint">
                                {TYPED_DURATION_HINT}
                            </p>
                            {typedError && (
                                <p className="duration-picker-edit-error">{typedError}</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <p
                className={`duration-picker-type-hint${locked || editing ? " is-hidden" : ""}`}
            >
                Double tap to type a time
            </p>
        </div>
    );
}

export default DurationScrollPicker;
