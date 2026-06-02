// Foreground app detection, kept pluggable so the rest of the app works even
// when the native module can't load (e.g. dev in WSL, or before `npm install`).
//
// Uses `get-windows` (the maintained successor to `active-win`), which is
// ESM-only — so we load it lazily via dynamic import() from this CommonJS file.
// If it fails to load we disable detection and log once; the Ctrl+Shift+B test
// trigger in blockerService still lets you exercise the friction UI.

let activeWindow = null;
let loadAttempted = false;
let loadFailed = false;

async function ensureLoaded() {
    if (activeWindow || loadAttempted) return;
    loadAttempted = true;
    try {
        const mod = await import("get-windows");
        activeWindow = mod.activeWindow;
    } catch (err) {
        loadFailed = true;
        console.warn(
            "[blocker] get-windows unavailable — foreground detection disabled. " +
                "Run `npm install get-windows`, or use Ctrl+Shift+B to test the overlay. " +
                `(${err.message})`
        );
    }
}

// Returns { name, title, path } for the focused window, or null if unavailable.
async function getForegroundApp() {
    await ensureLoaded();
    if (!activeWindow) return null;
    try {
        const win = await activeWindow();
        if (!win) return null;
        return {
            name: win.owner?.name || "",
            title: win.title || "",
            path: win.owner?.path || "",
        };
    } catch {
        return null;
    }
}

function isDetectionAvailable() {
    return !loadFailed;
}

module.exports = { getForegroundApp, isDetectionAvailable };
