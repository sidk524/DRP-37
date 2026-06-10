function requireTether() {
    if (!window.tether) {
        throw new Error("Tether desktop API is not available.");
    }
    return window.tether;
}

const BLOCK_SELECTIONS_KEY = "tether:blockSelections:v1";

function canUseLocalStorage() {
    return typeof window !== "undefined" && !!window.localStorage;
}

export function loadSavedBlockSelections() {
    if (!canUseLocalStorage()) return [];
    try {
        const raw = window.localStorage.getItem(BLOCK_SELECTIONS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((item) => typeof item === "string");
    } catch (error) {
        console.warn("Failed to load saved block selections:", error);
        return [];
    }
}

export function saveBlockSelections(selections) {
    if (!canUseLocalStorage()) return;
    try {
        const safeSelections = Array.isArray(selections) ? selections.filter((item) => typeof item === "string") : [];
        window.localStorage.setItem(BLOCK_SELECTIONS_KEY, JSON.stringify(safeSelections));
    } catch (error) {
        console.warn("Failed to save block selections:", error);
    }
}

export async function loadActiveSession() {
    return requireTether().getCurrentSession();
}

export async function createSession({ domainsBlocked, totalDurationSeconds }) {
    return requireTether().createSession({ domainsBlocked, totalDurationSeconds });
}

export async function endSession(sessionId) {
    return requireTether().endSession(sessionId);
}
