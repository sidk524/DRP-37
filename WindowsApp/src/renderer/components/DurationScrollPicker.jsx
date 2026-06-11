import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useCssVarNumber from "../hooks/useCssVarNumber";
import "../styles/DurationScrollPicker.css";

function DurationWheel({ value, min, max, onChange, locked, rowHeight }) {
    const items = useMemo(
        () => Array.from({ length: max - min + 1 }, (_, index) => min + index),
        [min, max],
    );
    const columnRef = useRef(null);
    const listRef = useRef(null);
    const syncingRef = useRef(false);

    const scrollToValue = useCallback(
        (nextValue, behavior = "auto") => {
            const list = listRef.current;
            if (!list) return;
            const index = Math.min(Math.max(nextValue - min, 0), items.length - 1);
            syncingRef.current = true;
            list.scrollTo({
                top: index * rowHeight,
                behavior,
            });
            requestAnimationFrame(() => {
                syncingRef.current = false;
            });
        },
        [items.length, min, rowHeight],
    );

    useEffect(() => {
        scrollToValue(value);
    }, [value, scrollToValue]);

    useEffect(() => {
        const column = columnRef.current;
        if (!column || locked) return;

        function handleWheel(event) {
            event.preventDefault();
            event.stopPropagation();

            const direction = Math.sign(event.deltaY);
            if (direction === 0) return;

            const next = Math.min(max, Math.max(min, value + direction));
            if (next !== value) {
                onChange(next);
            }
        }

        column.addEventListener("wheel", handleWheel, { passive: false });
        return () => column.removeEventListener("wheel", handleWheel);
    }, [locked, max, min, onChange, value]);

    function handleScroll() {
        if (locked || syncingRef.current) return;
        const list = listRef.current;
        if (!list) return;

        const index = Math.round(list.scrollTop / rowHeight);
        const next = min + Math.min(Math.max(index, 0), items.length - 1);
        if (next !== value) {
            onChange(next);
        }
    }

    return (
        <div
            ref={columnRef}
            className={`duration-wheel-column ${locked ? "locked" : ""}`}
        >
            <div
                className="duration-wheel-list"
                ref={listRef}
                onScroll={handleScroll}
            >
                {items.map((item) => (
                    <div
                        key={item}
                        className={`duration-wheel-row ${item === value ? "selected" : ""}`}
                    >
                        {String(item).padStart(2, "0")}
                    </div>
                ))}
            </div>
        </div>
    );
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
        setTypedDuration(
            `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
        );
    }, [editing, hours, minutes, seconds]);

    useEffect(() => {
        if (!editing) return;
        inputRef.current?.focus();
        inputRef.current?.select();
    }, [editing]);

    function parseTypedDuration(value) {
        const normalized = value.trim();
        if (!normalized) return null;

        if (/^[\dhms\s]+$/i.test(normalized) && /[hms]/i.test(normalized)) {
            const matches = normalized.matchAll(/(\d+)\s*([hms])/gi);
            let nextHours = 0;
            let nextMinutes = 0;
            let nextSeconds = 0;

            for (const match of matches) {
                const amount = Number(match[1]);
                const unit = match[2].toLowerCase();
                if (unit === "h") nextHours += amount;
                if (unit === "m") nextMinutes += amount;
                if (unit === "s") nextSeconds += amount;
            }

            nextMinutes += Math.floor(nextSeconds / 60);
            nextSeconds %= 60;
            nextHours += Math.floor(nextMinutes / 60);
            nextMinutes %= 60;

            if (nextHours > 23) return null;
            return { nextHours, nextMinutes, nextSeconds };
        }

        const parts = normalized.split(":").map((part) => part.trim());
        if (parts.length === 0 || parts.length > 3) return null;
        if (parts.some((part) => !/^\d+$/.test(part))) return null;

        const nums = parts.map((part) => Number(part));
        let nextHours = 0;
        let nextMinutes = 0;
        let nextSeconds = 0;

        if (nums.length === 3) {
            [nextHours, nextMinutes, nextSeconds] = nums;
        } else if (nums.length === 2) {
            [nextMinutes, nextSeconds] = nums;
        } else {
            [nextMinutes] = nums;
        }

        nextMinutes += Math.floor(nextSeconds / 60);
        nextSeconds %= 60;
        nextHours += Math.floor(nextMinutes / 60);
        nextMinutes %= 60;

        if (
            nextHours < 0 ||
            nextHours > 23 ||
            nextMinutes < 0 ||
            nextMinutes > 59 ||
            nextSeconds < 0 ||
            nextSeconds > 59
        ) {
            return null;
        }

        return { nextHours, nextMinutes, nextSeconds };
    }

    function applyTypedDuration() {
        const parsed = parseTypedDuration(typedDuration);
        if (!parsed) {
            setTypedError("Use HH:MM:SS, MM:SS, or 1h 30m");
            return;
        }

        setTypedError("");
        onHoursChange(parsed.nextHours);
        onMinutesChange(parsed.nextMinutes);
        onSecondsChange(parsed.nextSeconds);
        setEditing(false);
    }

    function cancelTypedDuration() {
        setTypedError("");
        setEditing(false);
    }

    return (
        <div className="duration-picker">
            <div
                className={`duration-picker-frame ${editing ? "editing" : ""}`}
                onDoubleClick={() => {
                    if (locked) return;
                    setTypedError("");
                    setEditing(true);
                }}
            >
                <div className="duration-picker-highlight" aria-hidden />
                <div className="duration-picker-wheels">
                    <DurationWheel
                        value={hours}
                        min={0}
                        max={23}
                        locked={locked}
                        rowHeight={rowHeight}
                        onChange={onHoursChange}
                    />
                    <DurationWheel
                        value={minutes}
                        min={0}
                        max={59}
                        locked={locked}
                        rowHeight={rowHeight}
                        onChange={onMinutesChange}
                    />
                    <DurationWheel
                        value={seconds}
                        min={0}
                        max={59}
                        locked={locked}
                        rowHeight={rowHeight}
                        onChange={onSecondsChange}
                    />
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
                                onChange={(event) => {
                                    setTypedDuration(event.target.value);
                                    if (typedError) setTypedError("");
                                }}
                                onBlur={applyTypedDuration}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        applyTypedDuration();
                                    }
                                    if (event.key === "Escape") {
                                        cancelTypedDuration();
                                    }
                                }}
                                placeholder="e.g. 00:25:00 or 25m"
                                aria-label="Type duration"
                            />
                            <p className="duration-picker-edit-hint">
                                Enter `HH:MM:SS`, `MM:SS`, or values like `1h 30m`, `90`.
                            </p>
                            {typedError && (
                                <p className="duration-picker-edit-error">{typedError}</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default DurationScrollPicker;
