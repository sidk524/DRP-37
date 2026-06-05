import { useEffect, useMemo, useState } from "react";
import {
    LETTER_PLACEHOLDER,
    STEPS,
    STRICTNESS_LEVELS,
} from "./Onboarding";
import { loadOnboarding, saveOnboarding } from "../services/SupabaseClient";
import "../styles/Onboarding.css";
import "../styles/Settings.css";

const DEFAULT_RESPONSES = {
    doMoreOf: [],
    scrollingWorst: [],
    futureMessage: "",
    strictness: "moderate",
};

function Settings({ session, onBack, onSaved }) {
    const [responses, setResponses] = useState(DEFAULT_RESPONSES);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [saved, setSaved] = useState(false);

    const choiceSteps = useMemo(() => STEPS.filter((step) => step.multiKey), []);
    const selectedStrictness = STRICTNESS_LEVELS.find((level) => level.value === responses.strictness);
    const canSave =
        responses.doMoreOf.length > 0 &&
        responses.scrollingWorst.length > 0 &&
        responses.futureMessage.trim().length > 0;

    useEffect(() => {
        let active = true;
        setLoading(true);
        loadOnboarding(session.user.id)
            .then((data) => {
                if (!active) return;
                setResponses(data || DEFAULT_RESPONSES);
            })
            .catch((err) => {
                if (!active) return;
                setError(err.message || "Could not load settings.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [session.user.id]);

    function toggleArrayItem(key, item) {
        setSaved(false);
        setResponses((prev) => {
            const arr = prev[key];
            return {
                ...prev,
                [key]: arr.includes(item)
                    ? arr.filter((value) => value !== item)
                    : [...arr, item],
            };
        });
    }

    function setFutureMessage(value) {
        setSaved(false);
        setResponses((prev) => ({
            ...prev,
            futureMessage: value,
        }));
    }

    function setStrictness(value) {
        setSaved(false);
        setResponses((prev) => ({
            ...prev,
            strictness: value,
        }));
    }

    async function handleSave() {
        if (!canSave) return;
        setSaving(true);
        setError("");
        setSaved(false);
        try {
            const nextResponses = {
                ...responses,
                futureMessage: responses.futureMessage.trim(),
            };
            await saveOnboarding(session.user.id, nextResponses);
            setResponses(nextResponses);
            await onSaved?.(nextResponses);
            setSaved(true);
        } catch (err) {
            setError(err.message || "Could not save settings.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="tether-screen settings-screen">
            <div className="settings-frame">
                <div className="tether-topbar">
                    <button type="button" className="tether-back" onClick={onBack}>
                        <span className="tether-back-chevron" aria-hidden />
                        Back
                    </button>
                    <span className="tether-topbar-duration">Settings</span>
                    <span className="tether-topbar-spacer" aria-hidden />
                </div>

                <h1 className="settings-title">Edit onboarding</h1>
                <p className="settings-subtitle">
                    Update the choices Tether uses for reminders and session strictness.
                </p>

                {loading ? (
                    <p className="settings-status">Loading settings...</p>
                ) : (
                    <div className="settings-stack">
                        {choiceSteps.map((step) => (
                            <section key={step.id} className="settings-card">
                                <p className="onboarding-section">{step.section}</p>
                                <h2 className="settings-card-title">{step.question}</h2>
                                <div className="onboarding-options">
                                    {step.options.map((option) => {
                                        const selected = responses[step.multiKey].includes(option.label);
                                        return (
                                            <button
                                                key={option.label}
                                                type="button"
                                                className={`onboarding-option ${selected ? "selected" : ""}`}
                                                onClick={() => toggleArrayItem(step.multiKey, option.label)}
                                            >
                                                <span className="onboarding-option-icon" aria-hidden>
                                                    {option.icon}
                                                </span>
                                                <span className="onboarding-option-label">{option.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        ))}

                        <section className="settings-card">
                            <p className="onboarding-section">Letter to self</p>
                            <h2 className="settings-card-title">Future-self message</h2>
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
                                    onChange={(e) => setFutureMessage(e.target.value)}
                                    rows={4}
                                />
                            </div>
                        </section>

                        <section className="settings-card">
                            <p className="onboarding-section">Strictness</p>
                            <h2 className="settings-card-title">How strict should we be?</h2>
                            <div className="strictness-options">
                                {STRICTNESS_LEVELS.map((level) => (
                                    <button
                                        key={level.value}
                                        type="button"
                                        className={`strictness-card strictness-${level.tint} ${
                                            responses.strictness === level.value ? "selected" : ""
                                        }`}
                                        onClick={() => setStrictness(level.value)}
                                    >
                                        <span className="strictness-icon" aria-hidden>
                                            {level.icon}
                                        </span>
                                        <span className="strictness-label">{level.label}</span>
                                    </button>
                                ))}
                            </div>
                            {selectedStrictness && (
                                <p className="strictness-footnote">{selectedStrictness.description}</p>
                            )}
                        </section>
                    </div>
                )}

                {error && <p className="auth-error onboarding-error settings-error">{error}</p>}
                {saved && <p className="settings-saved">Settings saved.</p>}

                <button
                    type="button"
                    className="btn-continue onboarding-cta settings-save"
                    disabled={!canSave || loading || saving}
                    onClick={handleSave}
                >
                    {saving ? "Saving..." : "Save settings"}
                </button>
            </div>
        </div>
    );
}

export default Settings;
