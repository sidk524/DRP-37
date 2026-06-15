import { useCallback, useEffect, useMemo, useRef } from "react";

const REPEAT_COUNT = 5;

function wrapValue(nextValue, min, max) {
    const count = max - min + 1;
    return ((nextValue - min) % count + count) % count + min;
}

function DurationWheel({ value, min, max, onChange, locked, rowHeight }) {
    const cycleLength = max - min + 1;
    const middleCycle = Math.floor(REPEAT_COUNT / 2);
    const items = useMemo(() => {
        const result = [];
        for (let repeat = 0; repeat < REPEAT_COUNT; repeat += 1) {
            for (let item = min; item <= max; item += 1) {
                result.push({ value: item, id: `${repeat}-${item}` });
            }
        }
        return result;
    }, [min, max]);
    const columnRef = useRef(null);
    const listRef = useRef(null);
    const syncingRef = useRef(false);

    const indexForValue = useCallback(
        (nextValue) => middleCycle * cycleLength + wrapValue(nextValue, min, max) - min,
        [cycleLength, middleCycle, min, max],
    );

    const scrollToIndex = useCallback(
        (index, behavior = "auto") => {
            const list = listRef.current;
            if (!list) return;
            syncingRef.current = true;
            list.scrollTo({
                top: index * rowHeight,
                behavior,
            });
            requestAnimationFrame(() => {
                syncingRef.current = false;
            });
        },
        [rowHeight],
    );

    const scrollToValue = useCallback(
        (nextValue, behavior = "auto") => {
            scrollToIndex(indexForValue(nextValue), behavior);
        },
        [indexForValue, scrollToIndex],
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

            const next = wrapValue(value + direction, min, max);
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
        const boundedIndex = Math.min(Math.max(index, 0), items.length - 1);
        const next = items[boundedIndex]?.value ?? value;

        const lowerBound = cycleLength;
        const upperBound = cycleLength * (REPEAT_COUNT - 1);
        if (index < lowerBound || index >= upperBound) {
            const normalized = wrapValue(next, min, max) - min;
            scrollToIndex(middleCycle * cycleLength + normalized);
        }

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
                        key={item.id}
                        className={`duration-wheel-row ${item.value === value ? "selected" : ""}`}
                    >
                        {String(item.value).padStart(2, "0")}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default DurationWheel;
