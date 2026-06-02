import { useEffect, useRef, useState } from "react";
import "../styles/Friction.css";

// Fallback used when opened directly in a browser (no Electron bridge), so the
// screen is still designable / viewable outside the app.
const DEFAULT_INFO = {
    app: "Instagram",
    key: "preview",
    mode: "breathing", // "breathing" | "reflect" | "hard"
    selfMessage: "Future me wants to wake up proud, not tired. Is this worth it?",
    breathSeconds: 4,
    breathCycles: 3,
};

const INTENTIONS = ["Check a message", "Post something", "Just looking"];

function Friction() {
    const [info, setInfo] = useState(DEFAULT_INFO);
    // breathing-mode sub-phase: "breathing" -> "intention"
    const [phase, setPhase] = useState("breathing");
    const [elapsed, setElapsed] = useState(0);
    const startRef = useRef(0);

    const mode = info.mode || "breathing";
    const breathSeconds = info.breathSeconds || 4;
    const breathCycles = info.breathCycles || 3;
    const cycleLength = breathSeconds * 2;
    const totalBreath = cycleLength * breathCycles;

    // Receive "show friction" events; each resets the flow.
    useEffect(() => {
        const api = window.tether;
        if (!api?.onShowFriction) return;
        return api.onShowFriction((data) => {
            setInfo({ ...DEFAULT_INFO, ...data });
            setPhase("breathing");
            setElapsed(0);
            startRef.current = 0;
        });
    }, []);

    // Breathing timer — only runs while in the breathing sub-phase of
    // breathing/reflect modes (hard mode never breathes).
    const breathingActive = phase === "breathing" && mode !== "hard";
    useEffect(() => {
        if (!breathingActive) return;
        let raf;
        const tick = () => {
            const now = performance.now();
            if (!startRef.current) startRef.current = now;
            const secs = (now - startRef.current) / 1000;
            setElapsed(secs);
            if (secs >= totalBreath) {
                setPhase("intention");
                return;
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [breathingActive, totalBreath]);

    const cyclePos = elapsed % cycleLength;
    const inhaling = cyclePos < breathSeconds;
    const breathLabel = inhaling ? "Breathe in" : "Breathe out";
    const canSkip = elapsed >= cycleLength;

    function continueThrough() {
        window.tether?.continueThrough(info.key);
    }

    function notNow() {
        window.tether?.notNow(info.key, mode);
    }

    return (
        <div className="friction">
            <div className="friction-inner">
                <p className="friction-app">You&apos;re about to open {info.app}</p>

                {/* ── HARD: no breathing, no way through ── */}
                {mode === "hard" ? (
                    <div className="hard-block">
                        <div className="hard-lock">🔒</div>
                        <h1 className="hard-title">{info.app} is blocked</h1>
                        <p className="friction-hint">You set this to hard block. There&apos;s no way through right now.</p>
                        <button className="friction-continue" onClick={notNow}>
                            Go back
                        </button>
                    </div>
                ) : phase === "breathing" ? (
                    /* ── Breathing pause (shared by breathing + reflect) ── */
                    <>
                        <div className="breath-stage">
                            <div
                                className={`breath-circle ${inhaling ? "inhale" : "exhale"}`}
                                style={{ animationDuration: `${cycleLength}s` }}
                            >
                                <span className="breath-label">{breathLabel}</span>
                            </div>
                        </div>
                        <p className="friction-hint">Take a breath before you scroll.</p>
                        <button
                            className={`friction-skip ${canSkip ? "" : "hidden"}`}
                            onClick={() => setPhase("intention")}
                        >
                            I&apos;m ready &rarr;
                        </button>
                    </>
                ) : mode === "reflect" ? (
                    /* ── REFLECT: purpose + past-self message ── */
                    <div className="reflect">
                        <div className="self-message">
                            <span className="self-message-label">A note from past you</span>
                            <p className="self-message-text">“{info.selfMessage}”</p>
                        </div>
                        <h2 className="reflect-title">Why are you opening {info.app}?</h2>
                        <div className="intention-options">
                            {INTENTIONS.map((reason) => (
                                <button key={reason} className="intention-chip" onClick={continueThrough}>
                                    {reason}
                                </button>
                            ))}
                        </div>
                        <button className="friction-continue" onClick={notNow}>
                            You&apos;re right — close it
                        </button>
                        <button className="friction-notnow" onClick={continueThrough}>
                            Continue anyway
                        </button>
                    </div>
                ) : (
                    /* ── BREATHING mode: simple intention then through ── */
                    <div className="intention">
                        <h1 className="intention-title">Why are you opening {info.app}?</h1>
                        <div className="intention-options">
                            {INTENTIONS.map((reason) => (
                                <button key={reason} className="intention-chip" onClick={continueThrough}>
                                    {reason}
                                </button>
                            ))}
                        </div>
                        <button className="friction-continue" onClick={continueThrough}>
                            Continue to {info.app}
                        </button>
                        <button className="friction-notnow" onClick={notNow}>
                            Actually, not now
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Friction;
