import { useState } from "react";
import { saveOnboarding } from "../services/SupabaseClient";
import "../styles/Onboarding.css";

export const STEPS = [
    {
        id: "goals",
        section: "Goals",
        question: "What do you wish you did more of?",
        multiKey: "doMoreOf",
        options: [
            { label: "Read more", icon: "📖" },
            { label: "Exercise", icon: "🏃" },
            { label: "Call family", icon: "📞" },
            { label: "Creative work", icon: "🎨" },
        ],
        nextLabel: "Continue",
    },
    {
        id: "worst",
        section: "Worst times",
        question: "When is scrolling worst for you?",
        multiKey: "scrollingWorst",
        options: [
            { label: "Late night", icon: "🌙" },
            { label: "First thing morning", icon: "☀️" },
            { label: "Meals", icon: "🍽️" },
            { label: "Work hours", icon: "💼" },
        ],
        nextLabel: "Continue",
    },
    {
        id: "letter",
        section: "Letter to self",
        question: null,
        helper:
            "Write a message to your future self. This shows when you're about to open a blocked app.",
        nextLabel: "Save & continue",
    },
    {
        id: "strictness",
        section: "Strictness",
        question: "How strict should we be?",
        nextLabel: "Done",
    },
];

export const STRICTNESS_LEVELS = [
    {
        value: "gentle",
        label: "Gentle nudges",
        icon: "🌱",
        tint: "gentle",
        description: "Gentle: a short breathing pause, then you can continue.",
    },
    {
        value: "moderate",
        label: "Firm friction",
        icon: "🔒",
        tint: "firm",
        description: "Firm: 10s pause + intention check. You can still get through.",
    },
    {
        value: "hard",
        label: "Hard block",
        icon: "⛔",
        tint: "hard",
        description: "Hard: no way through until your session ends.",
    },
];

export const LETTER_PLACEHOLDER =
    "You said you wanted to read before bed. Put the phone down. You'll feel better.";

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

    const current = STEPS[step];
    const selectedStrictness = STRICTNESS_LEVELS.find((l) => l.value === responses.strictness);

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
        if (step < STEPS.length - 1) {
            setStep(step + 1);
            return;
        }
        setSaving(true);
        setError("");
        try {
            await saveOnboarding(session.user.id, responses);
            onComplete(responses.strictness);
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
        <div className="app onboarding-app">
            <div className="onboarding-shell">
                {step > 0 && (
                    <button type="button" className="onboarding-back" onClick={handleBack}>
                        ← Back
                    </button>
                )}

                <div className="onboarding-card">
                    <p className="onboarding-section">{current.section}</p>

                    {current.question && (
                        <h1 className="onboarding-question">{current.question}</h1>
                    )}

                    {current.helper && (
                        <p className="onboarding-helper">{current.helper}</p>
                    )}

                    {current.multiKey && (
                        <div className="onboarding-options">
                            {current.options.map((opt) => {
                                const selected = responses[current.multiKey].includes(opt.label);
                                return (
                                    <button
                                        key={opt.label}
                                        type="button"
                                        className={`onboarding-option ${selected ? "selected" : ""}`}
                                        onClick={() => toggleArrayItem(current.multiKey, opt.label)}
                                    >
                                        <span className="onboarding-option-icon" aria-hidden>
                                            {opt.icon}
                                        </span>
                                        <span className="onboarding-option-label">{opt.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {current.id === "letter" && (
                        <div className="onboarding-letter">
                            <div className="letter-preview">
                                <p>
                                    {responses.futureMessage.trim()
                                        ? `“${responses.futureMessage.trim()}”`
                                        : `“${LETTER_PLACEHOLDER}”`}
                                </p>
                            </div>
                            <textarea
                                className="onboarding-textarea"
                                placeholder={LETTER_PLACEHOLDER}
                                value={responses.futureMessage}
                                onChange={(e) =>
                                    setResponses((prev) => ({
                                        ...prev,
                                        futureMessage: e.target.value,
                                    }))
                                }
                                rows={4}
                            />
                        </div>
                    )}

                    {current.id === "strictness" && (
                        <>
                            <div className="strictness-options">
                                {STRICTNESS_LEVELS.map((lvl) => (
                                    <button
                                        key={lvl.value}
                                        type="button"
                                        className={`strictness-card strictness-${lvl.tint} ${
                                            responses.strictness === lvl.value ? "selected" : ""
                                        }`}
                                        onClick={() =>
                                            setResponses((prev) => ({
                                                ...prev,
                                                strictness: lvl.value,
                                            }))
                                        }
                                    >
                                        <span className="strictness-icon" aria-hidden>
                                            {lvl.icon}
                                        </span>
                                        <span className="strictness-label">{lvl.label}</span>
                                    </button>
                                ))}
                            </div>
                            {selectedStrictness && (
                                <p className="strictness-footnote">{selectedStrictness.description}</p>
                            )}
                        </>
                    )}

                    {error && <p className="auth-error onboarding-error">{error}</p>}

                    <button
                        type="button"
                        className="btn-continue onboarding-cta"
                        disabled={!canAdvance() || saving}
                        onClick={handleNext}
                    >
                        {saving ? "Saving…" : current.nextLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Onboarding;
