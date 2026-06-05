import "../styles/Home.css";
import { useEffect, useRef, useState } from "react";
import { useAuthSession } from "../hooks/useAuthSession";
import { syncDefaultGroups } from "../services/GroupRepository";
import { loadOnboarding } from "../services/SupabaseClient";
import AuthScreen from "./AuthScreen";
import BlockerSetup, { strictnessToMode } from "../pages/BlockerSetup";
import Onboarding from "../pages/Onboarding";

function AuthGate() {
    const { session, loading } = useAuthSession();
    const [onboarded, setOnboarded] = useState(null);
    const [defaultMode, setDefaultMode] = useState("breathing");
    const syncedDefaultsForUserRef = useRef(null);

    useEffect(() => {
        if (!session) {
            setOnboarded(null);
            syncedDefaultsForUserRef.current = null;
            return;
        }
        loadOnboarding(session.user.id)
            .then((settings) => {
                if (settings?.strictness) {
                    setDefaultMode(strictnessToMode(settings.strictness));
                }
                if (settings && syncedDefaultsForUserRef.current !== session.user.id) {
                    syncedDefaultsForUserRef.current = session.user.id;
                    syncDefaultGroups({ scrollingWorst: settings.scrollingWorst })
                        .catch((error) => console.error("Failed to sync default groups:", error));
                }
                setOnboarded(!!settings);
            })
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

    return (
        <BlockerSetup
            session={session}
            defaultMode={defaultMode}
            onStrictnessChange={(strictness) => setDefaultMode(strictnessToMode(strictness))}
        />
    );
}

export default AuthGate;
