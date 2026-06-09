function requireTether() {
    if (!window.tether) {
        throw new Error("Tether desktop API is not available.");
    }
    return window.tether;
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
