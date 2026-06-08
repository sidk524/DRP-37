import "../styles/BlockerSetup.css";

function SessionComplete({ session, onDone }) {
    const { mode, actual_ms, blocked_apps_count, points } = session;

    const minutes = Math.floor(actual_ms / 60000);
    const seconds = Math.floor((actual_ms % 60000) / 1000);
    const focusedMinutes = Math.max(0, actual_ms) / 60000;

    const modeLabels = {
        breathing: "Breathing Mode",
        reflect: "Reflection Mode",
        hard: "Hard Mode"
    };

    const modeMultipliers = {
        breathing: "1x",
        reflect: "1.5x",
        hard: "2.5x"
    };

    const numericModeMultipliers = {
        breathing: 1,
        reflect: 1.5,
        hard: 2.5
    };

    const modeMultiplier = numericModeMultipliers[mode] || 1;
    const appsMultiplier = 1 + (Math.max(1, blocked_apps_count) - 1) * 0.25;

    const timePoints = focusedMinutes;
    const modePoints = focusedMinutes * (modeMultiplier - 1);
    const appsPoints = focusedMinutes * modeMultiplier * (appsMultiplier - 1);

    const formatPoints = (value) => {
        const rounded = Math.round(value * 10) / 10;
        return Number.isInteger(rounded) ? rounded : rounded.toFixed(1);
    };

    return (
        <div className="tether-screen">
            <div className="tether-frame tether-complete">
                <div className="tether-complete-icon">🎉</div>
                <h1 className="tether-title">Session Complete!</h1>
                <p className="tether-subtitle">Well done! You stayed focused.</p>

                <div className="tether-points-large">
                    <span className="tether-points-value">{points}</span>
                    <span className="tether-points-label">points earned</span>
                </div>

                <div className="tether-breakdown">
                    <h2 className="tether-breakdown-title">Points Breakdown</h2>
                    
                    <div className="tether-breakdown-item">
                        <div className="tether-breakdown-info">
                            <span className="tether-breakdown-label">Time Focused</span>
                            <span className="tether-breakdown-value">
                                {minutes > 0 ? `${minutes}m ` : ""}{seconds}s ({formatPoints(timePoints)} point{blocked_apps_count === 1 ? "" : "s"})
                            </span>
                        </div>
                    </div>

                    <div className="tether-breakdown-item">
                        <div className="tether-breakdown-info">
                            <span className="tether-breakdown-label">Focus Mode</span>
                            <span className="tether-breakdown-value">
                                {modeLabels[mode] || mode} ({modeMultipliers[mode] || "1x"}) ({formatPoints(modePoints)} point{blocked_apps_count === 1 ? "" : "s"})
                            </span>
                        </div>
                    </div>

                    <div className="tether-breakdown-item">
                        <div className="tether-breakdown-info">
                            <span className="tether-breakdown-label">Apps & Websites</span>
                            <span className="tether-breakdown-value">
                                {blocked_apps_count} item{blocked_apps_count === 1 ? "" : "s"} (+{(blocked_apps_count - 1) * 25}%) ({formatPoints(appsPoints)} point{blocked_apps_count === 1 ? "" : "s"})
                            </span>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    className="tether-lockin tether-complete-btn"
                    onClick={onDone}
                >
                    Back to Timer
                </button>
            </div>
        </div>
    );
}

export default SessionComplete;
