import { useState } from "react";
import DurationWheel from "./DurationWheel";
import useCssVarNumber from "../hooks/useCssVarNumber";
import "../styles/DurationScrollPicker.css";

const MAX_HOURS = 23;
const MAX_MINUTES = 59;
const MAX_SECONDS = 59;

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
    const [activeColumn, setActiveColumn] = useState(null);

    const wheelConfigs = [
        {
            id: "hours",
            value: hours,
            max: MAX_HOURS,
            onChange: onHoursChange,
        },
        {
            id: "minutes",
            value: minutes,
            max: MAX_MINUTES,
            onChange: onMinutesChange,
        },
        {
            id: "seconds",
            value: seconds,
            max: MAX_SECONDS,
            onChange: onSecondsChange,
        },
    ];

    return (
        <div className="duration-picker">
            <div className="duration-picker-frame">
                <div className="duration-picker-highlight" aria-hidden />
                <div className="duration-picker-wheels">
                    {wheelConfigs.map((config) => (
                        <DurationWheel
                            key={config.id}
                            value={config.value}
                            min={0}
                            max={config.max}
                            locked={locked}
                            rowHeight={rowHeight}
                            isEditing={activeColumn === config.id}
                            onActivate={() => {
                                if (!locked) setActiveColumn(config.id);
                            }}
                            onScrollStart={() => setActiveColumn(null)}
                            onChange={config.onChange}
                        />
                    ))}
                </div>
                <div className="duration-picker-labels">
                    <span>hours</span>
                    <span>min</span>
                    <span>sec</span>
                </div>
            </div>
            <p
                className={`duration-picker-type-hint${locked || activeColumn ? " is-hidden" : ""}`}
            >
                Tap a column to type
            </p>
        </div>
    );
}

export default DurationScrollPicker;
