import { Routes, Route } from "react-router-dom";
import AuthGate from "./components/AuthGate";
import Friction from "./pages/Friction";

function App() {
    return (
        <Routes>
            {/* Loaded directly into the overlay window, independent of auth */}
            <Route path="/friction" element={<Friction />} />
            {/* Main window: session decides Login vs BlockerSetup */}
            <Route path="*" element={<AuthGate />} />
        </Routes>
    );
}

export default App;
