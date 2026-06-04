import AuthGate from "./components/AuthGate";
import Friction from "./pages/Friction";

function App() {
    if (window.tether?.isOverlay) {
        return <Friction />;
    }
    return <AuthGate />;
}

export default App;
