import { Component } from "react";

// Without this, any render-time throw unmounts the whole tree and leaves a
// blank white window with no clue what happened. This catches the error and
// shows the message + stack on screen (and logs it), so failures are visible.
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null, info: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        this.setState({ info });
        console.error("[renderer] uncaught render error:", error, info?.componentStack);
    }

    render() {
        const { error, info } = this.state;
        if (!error) return this.props.children;

        return (
            <div
                style={{
                    padding: "32px",
                    fontFamily: "monospace",
                    color: "#ffb4b4",
                    background: "#1a1111",
                    minHeight: "100vh",
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                }}
            >
                <h2 style={{ color: "#ff6b6b" }}>Something crashed while rendering</h2>
                <p style={{ color: "#fff" }}>{String(error?.message || error)}</p>
                {error?.stack && <pre>{error.stack}</pre>}
                {info?.componentStack && (
                    <pre style={{ color: "#888" }}>{info.componentStack}</pre>
                )}
            </div>
        );
    }
}

export default ErrorBoundary;
