import "../styles/Home.css";
import { useAuthSession } from "../hooks/useAuthSession";
import AuthScreen from "./AuthScreen";
import BlockerSetup from "../pages/BlockerSetup";

// Reactive auth gate — the Electron equivalent of Android's MainActivity:
//   session present  -> BlockerSetup
//   no session       -> AuthScreen
function AuthGate() {
    const { session, loading } = useAuthSession();

    if (loading) {
        return (
            <div className="app">
                <p className="auth-loading">Loading…</p>
            </div>
        );
    }

    return session ? <BlockerSetup session={session} /> : <AuthScreen />;
}

export default AuthGate;
