import "../styles/BlockerSetup.css";
import { useState } from "react";
import { signOut } from "../services/SupabaseClient";

// Post-auth landing — the Electron equivalent of Android's BlockerSetupScreen
// ("Block Apps": pick apps + duration -> Start Session). This is a v1 shell;
// the full 3-step setup flow builds on top of it.
const CANDIDATE_APPS = [
    "Instagram",
    "TikTok",
    "YouTube",
    "X (Twitter)",
    "Reddit",
    "Facebook",
];

const DURATIONS = [15, 30, 60, 120];

function BlockerSetup({ session }) {
    const [selected, setSelected] = useState(() => new Set());
    const [duration, setDuration] = useState(30);

    const email = session?.user?.email || "your account";

    function toggle(app) {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(app) ? next.delete(app) : next.add(app);
            return next;
        });
    }

    async function handleSignOut() {
        await signOut(); // AuthGate reacts and returns to the login screen
    }

    function handleStart() {
        // TODO: push selection to the main-process blocker (and Supabase) to
        // start a session. For now, log it.
        console.log("Start session:", { apps: [...selected], duration });
    }

    return (
        <div className="setup">
            <div className="setup-inner">
                <div className="setup-topbar">
                    <span className="setup-account">{email}</span>
                    <button className="setup-signout" onClick={handleSignOut}>
                        Sign out
                    </button>
                </div>

                <h1 className="setup-title">Block Apps</h1>
                <p className="setup-count">{selected.size} apps selected</p>

                <div className="setup-grid">
                    {CANDIDATE_APPS.map((app) => {
                        const isOn = selected.has(app);
                        return (
                            <button
                                key={app}
                                className={`setup-app ${isOn ? "on" : ""}`}
                                onClick={() => toggle(app)}
                            >
                                <span className="setup-app-dot" />
                                {app}
                            </button>
                        );
                    })}
                </div>

                <div className="setup-durations">
                    {DURATIONS.map((d) => (
                        <button
                            key={d}
                            className={`setup-duration ${duration === d ? "on" : ""}`}
                            onClick={() => setDuration(d)}
                        >
                            {d >= 60 ? `${d / 60}h` : `${d}m`}
                        </button>
                    ))}
                </div>

                <button
                    className="setup-start"
                    disabled={selected.size === 0}
                    onClick={handleStart}
                >
                    Start Session · {selected.size} apps
                </button>
            </div>
        </div>
    );
}

export default BlockerSetup;
