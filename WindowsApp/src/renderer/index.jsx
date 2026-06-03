import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import {HashRouter} from "react-router-dom";

// Surface async errors that escape React (rejected promises, event handlers)
// so a blank window always leaves a trace in the console.
window.addEventListener('error', (e) => console.error('[renderer] window error:', e.error || e.message))
window.addEventListener('unhandledrejection', (e) => console.error('[renderer] unhandled rejection:', e.reason))

ReactDOM.createRoot(document.getElementById('root')).render(
    <ErrorBoundary>
        <HashRouter>
            <App />
        </HashRouter>
    </ErrorBoundary>
)
