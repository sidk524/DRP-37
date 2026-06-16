import AuthGate from "./components/AuthGate";
import AppChrome from "./components/AppChrome";

function App() {
    return (
        <AppChrome>
            <AuthGate />
        </AppChrome>
    );
}

export default App;
