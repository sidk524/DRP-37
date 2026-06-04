import "../styles/Home.css";
import { useState } from "react";
import {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
} from "../services/SupabaseClient";

// Single auth screen with a Login <-> SignUp toggle, mirroring the Android
// LoginScreen. On success there is no navigate() — the auth state change is
// observed by AuthGate, which swaps to BlockerSetup automatically.
function AuthScreen() {
    const [mode, setMode] = useState("login"); // "login" | "signup"
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
    const [loading, setLoading] = useState(false);

    const isLogin = mode === "login";
    const canSubmit = email.trim() && password && !loading;

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        setInfo("");
        if (!canSubmit) {
            setError("Email and password are required.");
            return;
        }

        setLoading(true);
        try {
            if (isLogin) {
                await signInWithEmail(email.trim(), password);
                // No navigation: AuthGate reacts to the session change.
            } else {
                const data = await signUpWithEmail(email.trim(), password);
                // With email confirmation on, sign-up returns no session until
                // the link is clicked — tell the user instead of doing nothing.
                if (!data?.session) {
                    setMode("login");
                    setPassword("");
                    setInfo("Account created. Check your email to confirm, then log in.");
                }
            }
        } catch (err) {
            setError(err.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    async function handleGoogle() {
        setError("");
        setInfo("");
        setLoading(true);
        try {
            await signInWithGoogle();
        } catch (err) {
            setError(err.message || "Google sign-in isn't available yet.");
            setLoading(false);
        }
    }

    function toggleMode() {
        setMode(isLogin ? "signup" : "login");
        setEmail("");
        setPassword("");
        setError("");
        setInfo("");
    }

    return (
        <div className="app">
            <div className="auth-container">
                {/* Logo */}
                <div className="logo">
                    <span className="logo-text">
                        tet<span className="logo-accent">H</span>er
                    </span>
                </div>

                {/* Heading */}
                <div className="heading-group">
                    <h1 className="title">{isLogin ? "Welcome back!!!" : "Create an account"}</h1>
                    <p className="subtitle">
                        {isLogin
                            ? "Log in to continue your focus journey"
                            : "Enter your email to sign up for Tether"}
                    </p>
                </div>

                {/* Form */}
                <form className="form-group" onSubmit={handleSubmit}>
                    <input
                        name="email"
                        type="email"
                        className="input-field"
                        placeholder="email@domain.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                        name="password"
                        type="password"
                        className="input-field"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    {error && <p className="auth-error">{error}</p>}
                    {info && <p className="auth-info">{info}</p>}
                    <button className="btn-continue" disabled={!canSubmit}>
                        {loading ? "Please wait…" : isLogin ? "Log in" : "Continue"}
                    </button>
                </form>

                {/* Divider */}
                <div className="divider">
                    <span className="divider-line" />
                    <span className="divider-text">or</span>
                    <span className="divider-line" />
                </div>

                {/* Google */}
                <button className="btn-google" type="button" onClick={handleGoogle} disabled={loading}>
                    <svg className="google-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.85l6.09-6.09C34.46 3.05 29.5 1 24 1 14.82 1 7.07 6.48 3.64 14.18l7.08 5.5C12.4 13.02 17.73 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.1 24.5c0-1.64-.15-3.22-.42-4.75H24v9h12.42c-.54 2.9-2.18 5.36-4.64 7.01l7.19 5.58C43.18 37.28 46.1 31.36 46.1 24.5z"/>
                        <path fill="#FBBC05" d="M10.72 28.32A14.54 14.54 0 0 1 9.5 24c0-1.5.26-2.95.72-4.32l-7.08-5.5A23.94 23.94 0 0 0 0 24c0 3.86.92 7.5 2.56 10.72l8.16-6.4z"/>
                        <path fill="#34A853" d="M24 47c5.5 0 10.12-1.82 13.5-4.96l-7.19-5.58C28.6 37.96 26.42 38.5 24 38.5c-6.27 0-11.6-3.52-13.28-8.18l-8.16 6.4C6.07 44.52 14.45 47 24 47z"/>
                    </svg>
                    <span>Continue with Google</span>
                </button>

                {/* Toggle */}
                <p className="login-text">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                    <button type="button" className="login-link login-link-btn" onClick={toggleMode}>
                        {isLogin ? "Sign up" : "Log in"}
                    </button>
                </p>

                {/* Footer */}
                <p className="footer-text">
                    By clicking continue, you agree to our{" "}
                    <a href="#" className="footer-link">Terms of Service</a>{" "}and{" "}
                    <a href="#" className="footer-link">Privacy Policy</a>
                </p>
            </div>
        </div>
    );
}

export default AuthScreen;
