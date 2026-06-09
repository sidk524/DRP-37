import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/responsive.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
window.addEventListener('error', (e) => console.error('[renderer] window error:', e.error || e.message))
window.addEventListener('unhandledrejection', (e) => console.error('[renderer] unhandled rejection:', e.reason))

ReactDOM.createRoot(document.getElementById('root')).render(
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
)
