import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const REPEAT_COUNT = 5;
const DRAG_THRESHOLD_PX = 6;

function wrapValue(nextValue, min, max) {
    const count = max - min + 1;
    return ((nextValue - min) % count + count) % count + min;
}

function parseColumnInput(raw, maxValue) {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    if (!digits) return { text: "", value: null };

    const numeric = Number(digits);
    if (Number.isNaN(numeric)) return { text: digits, value: null };
    if (numeric > maxValue) {
        return { text: String(maxValue), value: maxValue };
    }
    return { text: digits, value: numeric };
}

function DurationWheel({
    value,
    min,
    max,
    onChange,
    locked,
    rowHeight,
    isEditing = false,
    onActivate,
    onScrollStart,
}) {
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
    const inputRef = useRef(null);
    const syncingRef = useRef(false);
    const wasScrollingRef = useRef(false);
    const dragRef = useRef(null);
    const [typedText, setTypedText] = useState("");
    const [hoverNumber, setHoverNumber] = useState(false);

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

    const isInCenterBand = useCallback(
        (clientY) => {
            const column = columnRef.current;
            if (!column) return false;
            const rect = column.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2;
            return Math.abs(clientY - centerY) <= rowHeight / 2 + 8;
        },
        [rowHeight],
    );

    useEffect(() => {
        scrollToValue(value);
    }, [value, scrollToValue]);

    useEffect(() => {
        if (!isEditing) return;
        setTypedText(String(value));
        inputRef.current?.focus();
        inputRef.current?.select();
    }, [isEditing]);

    useEffect(() => {
        const column = columnRef.current;
        if (!column || locked) return;

        function handleWheel(event) {
            if (isEditing) {
                onScrollStart?.();
            }
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
    }, [isEditing, locked, max, min, onChange, onScrollStart, value]);

    function handleScroll() {
        if (locked || syncingRef.current) return;
        const list = listRef.current;
        if (!list) return;

        if (isEditing && !wasScrollingRef.current) {
            wasScrollingRef.current = true;
            onScrollStart?.();
        }

        const index = Math.round(list.scrollTop / rowHeight);
        const boundedIndex = Math.min(Math.max(index, 0), items.length - 1);
        const next = items[boundedIndex]?.value ?? value;

        const lowerBound = cycleLength;
        const upperBound = cycleLength * (REPEAT_COUNT - 1);
        if (index < lowerBound || index >= upperBound) {
            const normalized = wrapValue(next, min, max) - min;
            scrollToIndex(middleCycle * cycleLength + normalized);
        }

        if (!isEditing && next !== value) {
            onChange(next);
        }
    }

    function handleScrollEnd() {
        wasScrollingRef.current = false;
    }

    function handlePointerDown(event) {
        if (locked || isEditing || event.button !== 0) return;
        if (event.target.closest(".duration-wheel-inline-input")) return;

        dragRef.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startScrollTop: listRef.current?.scrollTop ?? 0,
            activatePending: isInCenterBand(event.clientY),
        };
        columnRef.current?.setPointerCapture(event.pointerId);
    }

    function handlePointerMove(event) {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId || locked || isEditing) return;

        const deltaY = event.clientY - drag.startY;
        if (Math.abs(deltaY) <= DRAG_THRESHOLD_PX) return;

        drag.activatePending = false;
        const list = listRef.current;
        if (!list) return;
        list.scrollTop = drag.startScrollTop - deltaY;
    }

    function handlePointerUp(event) {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;

        if (drag.activatePending && !locked && !isEditing) {
            onActivate?.();
        }

        dragRef.current = null;
        columnRef.current?.releasePointerCapture(event.pointerId);
    }

    function handlePointerCancel(event) {
        if (dragRef.current?.pointerId === event.pointerId) {
            dragRef.current = null;
        }
    }

    function handleMouseMove(event) {
        if (locked || isEditing) {
            setHoverNumber(false);
            return;
        }
        setHoverNumber(isInCenterBand(event.clientY));
    }

    function handleMouseLeave() {
        setHoverNumber(false);
    }

    function handleInputChange(event) {
        const { text, value: nextValue } = parseColumnInput(event.target.value, max);
        setTypedText(text);
        if (nextValue != null) {
            onChange(nextValue);
        }
    }

    function handleInputKeyDown(event) {
        if (event.key === "Enter" || event.key === "Escape") {
            onScrollStart?.();
        }
    }

    function handleInputBlur() {
        onScrollStart?.();
    }

    const columnClassName = [
        "duration-wheel-column",
        locked ? "locked" : "",
        isEditing ? "is-editing" : "",
        hoverNumber && !locked && !isEditing ? "is-hover-number" : "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div
            ref={columnRef}
            className={columnClassName}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <div
                className="duration-wheel-list"
                ref={listRef}
                onScroll={handleScroll}
                onTouchEnd={handleScrollEnd}
                onMouseUp={handleScrollEnd}
            >
                {items.map((item) => {
                    const isSelected = item.value === value;
                    return (
                        <div
                            key={item.id}
                            className={`duration-wheel-row ${isSelected && !isEditing ? "selected" : ""} ${isSelected && isEditing ? "selected-editing" : ""}`}
                        >
                            {String(item.value).padStart(2, "0")}
                        </div>
                    );
                })}
            </div>
            {isEditing && !locked ? (
                <input
                    ref={inputRef}
                    className="duration-wheel-inline-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={typedText}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    onKeyDown={handleInputKeyDown}
                    aria-label="Type duration value"
                />
            ) : null}
        </div>
    );
}

export default DurationWheel;
