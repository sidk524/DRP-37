import { useState } from "react";
import { saveOnboarding } from "../services/SupabaseClient";
import "../styles/Onboarding.css";

const DO_MORE_OPTIONS = [
    "Exercise",
    "Reading",
    "Creative work",
    "Learning",
    "Socialising",
    "Meditation",
    "Side projects",
    "Sleep",
];

const SCROLLING_WORST_OPTIONS = [
    "First thing in the morning",
    "Late at night",
    "During work / study",
    "When I'm bored",
    "When I'm stressed",
    "On public transport",
];

const STRICTNESS_LEVELS = [
    { value: "gentle", label: "Gentle", desc: "Soft reminders, easy to dismiss" },
    { value: "moderate", label: "Moderate", desc: "Noticeable nudges, some friction" },
    { value: "strict", label: "Strict", desc: "Hard blocks, difficult to bypass" },
];

function Onboarding({ session, onComplete }) {
    const [step, setStep] = useState(0);
    const [responses, setResponses] = useState({
        doMoreOf: [],
        scrollingWorst: [],
        futureMessage: "",
        strictness: "moderate",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const totalSteps = 4;

    function toggleArrayItem(key, item) {
        setResponses((prev) => {
            const arr = prev[key];
            return {
                ...prev,
                [key]: arr.includes(item)
                    ? arr.filter((i) => i !== item)
                    : [...arr, item],
            };
        });
    }

    function canAdvance() {
        if (step === 0) return responses.doMoreOf.length > 0;
        if (step === 1) return responses.scrollingWorst.length > 0;
        if (step === 2) return responses.futureMessage.trim().length > 0;
        return true;
    }

    async function handleNext() {
        if (step < totalSteps - 1) {
            setStep(step + 1);
            return;
        }
        setSaving(true);
        setError("");
        try {
            await saveOnboarding(session.user.id, responses);
            onComplete();
        } catch (err) {
            setError(err.message || "Failed to save. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    function handleBack() {
        if (step > 0) setStep(step - 1);
    }

    return (
        <div className="app">
            <div className="onboarding-container">
                {/* Progress */}
                <div className="onboarding-progress">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                        <span
                            key={i}
                            className={`progress-dot ${i <= step ? "active" : ""}`}
                        />
                    ))}
                </div>

                {/* Step 0: What do you want to do more of? */}
                {step === 0 && (
                    <div className="onboarding-step">
                        <h1 className="onboarding-title">What do you want to do more of?</h1>
                        <p className="onboarding-subtitle">Select all that apply</p>
                        <div className="chip-grid">
                            {DO_MORE_OPTIONS.map((opt) => (
                                <button
                                    key={opt}
                                    type="button"
                                    className={`chip ${responses.doMoreOf.includes(opt) ? "selected" : ""}`}
                                    onClick={() => toggleArrayItem("doMoreOf", opt)}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 1: When is scrolling worst? */}
                {step === 1 && (
                    <div className="onboarding-step">
                        <h1 className="onboarding-title">When is scrolling worst?</h1>
                        <p className="onboarding-subtitle">Select all that apply</p>
                        <div className="chip-grid">
                            {SCROLLING_WORST_OPTIONS.map((opt) => (
                                <button
                                    key={opt}
                                    type="button"
                                    className={`chip ${responses.scrollingWorst.includes(opt) ? "selected" : ""}`}
                                    onClick={() => toggleArrayItem("scrollingWorst", opt)}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2: Write a message to your future self */}
                {step === 2 && (
                    <div className="onboarding-step">
                        <h1 className="onboarding-title">Write a message to your future self</h1>
                        <p className="onboarding-subtitle">
                            This will be shown when you're tempted to scroll
                        </p>
                        <textarea
                            className="onboarding-textarea"
                            placeholder="Hey future me, remember why you started…"
                            value={responses.futureMessage}
                            onChange={(e) =>
                                setResponses((prev) => ({ ...prev, futureMessage: e.target.value }))
                            }
                            rows={5}
                        />
                    </div>
                )}

                {/* Step 3: How strict should we be? */}
                {step === 3 && (
                    <div className="onboarding-step">
                        <h1 className="onboarding-title">How strict should we be?</h1>
                        <p className="onboarding-subtitle">You can change this later</p>
                        <div className="strictness-options">
                            {STRICTNESS_LEVELS.map((lvl) => (
                                <button
                                    key={lvl.value}
                                    type="button"
                                    className={`strictness-card ${responses.strictness === lvl.value ? "selected" : ""}`}
                                    onClick={() =>
                                        setResponses((prev) => ({ ...prev, strictness: lvl.value }))
                                    }
                                >
                                    <span className="strictness-label">{lvl.label}</span>
                                    <span className="strictness-desc">{lvl.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {error && <p className="auth-error">{error}</p>}

                {/* Navigation */}
                <div className="onboarding-nav">
                    {step > 0 && (
                        <button type="button" className="btn-back" onClick={handleBack}>
                            Back
                        </button>
                    )}
                    <button
                        type="button"
                        className="btn-continue"
                        disabled={!canAdvance() || saving}
                        onClick={handleNext}
                    >
                        {saving
                            ? "Saving…"
                            : step === totalSteps - 1
                                ? "Get started"
                                : "Next"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Onboarding;
