import "../styles/LockGraphic.css";

function LockGraphic({ locked }) {
    return (
        <div className={`lock-graphic ${locked ? "locked" : ""}`} aria-hidden>
            <svg className="lock-graphic-svg" viewBox="0 0 120 120">
                <rect
                    className="lock-body"
                    x="28"
                    y="52"
                    width="64"
                    height="48"
                    rx="10"
                />
                <path
                    className="lock-shackle"
                    d="M 52 52 A 28 28 0 0 1 88 52"
                    fill="none"
                    strokeWidth="9"
                    strokeLinecap="round"
                />
                <circle className="lock-keyhole-top" cx="60" cy="68" r="7" />
                <path className="lock-keyhole-bottom" d="M 52 72 L 68 72 L 62 92 L 58 92 Z" />
            </svg>
        </div>
    );
}

export default LockGraphic;
