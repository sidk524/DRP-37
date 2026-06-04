import { useCallback, useEffect, useMemo, useRef } from "react";
import "../styles/DurationScrollPicker.css";

const ROW_HEIGHT = 56;

function DurationWheel({ value, min, max, onChange }) {
    const items = useMemo(
        () => Array.from({ length: max - min + 1 }, (_, index) => min + index),
        [min, max],
    );
    const listRef = useRef(null);
    const scrollEndTimer = useRef(null);

    const scrollToValue = useCallback(
        (nextValue, behavior = "auto") => {
            const list = listRef.current;
            if (!list) return;
            const index = Math.min(Math.max(nextValue - min, 0), items.length - 1);
            list.scrollTo({
                top: index * ROW_HEIGHT,
                behavior,
            });
        },
        [items.length, min],
    );

    useEffect(() => {
        scrollToValue(value);
    }, [value, scrollToValue]);

    function handleScroll() {
        const list = listRef.current;
        if (!list) return;

        if (scrollEndTimer.current) {
            clearTimeout(scrollEndTimer.current);
        }

        scrollEndTimer.current = setTimeout(() => {
            const index = Math.round(list.scrollTop / ROW_HEIGHT);
            const next = min + Math.min(Math.max(index, 0), items.length - 1);
            if (next !== value) {
                onChange(next);
            }
        }, 80);
    }

    return (
        <div className="duration-wheel-column">
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

function DurationScrollPicker({ durationMinutes, onDurationChange }) {
    const totalSeconds = Math.max(5, Math.max(1, durationMinutes) * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    function publish(nextHours, nextMinutes, nextSeconds) {
        const combined = Math.max(5, nextHours * 3600 + nextMinutes * 60 + nextSeconds);
        onDurationChange(Math.max(1, Math.ceil(combined / 60)));
    }

    return (
        <div className="duration-picker">
            <div className="duration-picker-frame">
                <div className="duration-picker-highlight" aria-hidden />
                <div className="duration-picker-wheels">
                    <DurationWheel
                        value={hours}
                        min={0}
                        max={23}
                        onChange={(next) => publish(next, minutes, seconds)}
                    />
                    <DurationWheel
                        value={minutes}
                        min={0}
                        max={59}
                        onChange={(next) => publish(hours, next, seconds)}
                    />
                    <DurationWheel
                        value={seconds}
                        min={0}
                        max={59}
                        onChange={(next) => publish(hours, minutes, next)}
                    />
                </div>
                <div className="duration-picker-labels">
                    <span>hours</span>
                    <span>min</span>
                    <span>sec</span>
                </div>
            </div>
        </div>
    );
}

export default DurationScrollPicker;
