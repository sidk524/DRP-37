import "../styles/Home.css";
import { useEffect, useState } from "react";
import { useAuthSession } from "../hooks/useAuthSession";
import { checkOnboardingComplete } from "../services/SupabaseClient";
import AuthScreen from "./AuthScreen";
import BlockerSetup, { strictnessToMode } from "../pages/BlockerSetup";
import Onboarding from "../pages/Onboarding";

// Reactive auth gate — the Electron equivalent of Android's MainActivity:
//   no session          -> AuthScreen
//   session, no onboard -> Onboarding
//   session + onboarded -> BlockerSetup (session page first; Block Apps on demand)
function AuthGate() {
    const { session, loading } = useAuthSession();
    const [onboarded, setOnboarded] = useState(null);
    const [defaultMode, setDefaultMode] = useState("breathing");

    useEffect(() => {
        if (!session) {
            setOnboarded(null);
            return;
        }
        checkOnboardingComplete(session.user.id)
            .then(setOnboarded)
            .catch(() => setOnboarded(false));
    }, [session]);

    if (loading) {
        return (
            <div className="app">
                <p className="auth-loading">Loading…</p>
            </div>
        );
    }

    if (!session) return <AuthScreen />;

    if (onboarded === null) {
        return (
            <div className="app">
                <p className="auth-loading">Loading…</p>
            </div>
        );
    }

    if (!onboarded) {
        return (
            <Onboarding
                session={session}
                onComplete={(strictness) => {
                    setDefaultMode(strictnessToMode(strictness));
                    setOnboarded(true);
                }}
            />
        );
    }

    return <BlockerSetup session={session} defaultMode={defaultMode} />;
}

export default AuthGate;
