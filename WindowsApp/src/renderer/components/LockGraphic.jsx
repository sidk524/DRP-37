import "../styles/LockGraphic.css";

function LockGraphic({ locked }) {
    return (
        <div className={`lock-graphic ${locked ? "locked" : ""}`} aria-hidden>
            <svg className="lock-graphic-svg" viewBox="0 0 100 100">
                <g className="lock-shackle-wrap">
                    <path
                        className="lock-shackle"
                        d="M 30 44 A 23 25 0 0 1 76 44"
                    />
                </g>
                <rect className="lock-body" x="22" y="44" width="64" height="42" rx="9" />
                <circle className="lock-keyhole-top" cx="54" cy="60" r="7" />
                <path
                    className="lock-keyhole-bottom"
                    d="M 50.16 62.9 L 57.84 62.9 L 61.68 76.76 L 46.32 76.76 Z"
                />
            </svg>
        </div>
    );
}

export default LockGraphic;
