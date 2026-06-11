import { useCallback, useEffect, useMemo, useRef } from "react";

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

export default DurationWheel;