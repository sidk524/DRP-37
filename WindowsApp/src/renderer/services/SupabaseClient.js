function requireTether() {
    if (typeof window === "undefined" || !window.tether) {
        throw new Error("Tether desktop API is not available.");
    }
    return window.tether;
}

export async function signUpWithEmail(email, password) {
    return requireTether().signUpWithEmail(email, password);
}

export async function signInWithEmail(email, password) {
    const session = await requireTether().signInWithEmail(email, password);
    return { session };
}

export async function signInWithGoogle() {
    const session = await requireTether().signInWithGoogle();
    return { session };
}

export async function getSession() {
    return requireTether().getSession();
}

export async function signOut() {
    await requireTether().signOut();
}

export async function getCurrentUser() {
    const session = await getSession();
    return session?.user ?? null;
}

export async function checkOnboardingComplete(_userId) {
    const settings = await loadOnboarding();
    return !!settings;
}

export async function loadOnboarding(_userId) {
    return requireTether().loadOnboarding();
}

export async function saveOnboarding(_userId, responses) {
    return requireTether().saveOnboarding(responses);
}

export async function saveSessionPoints(payload) {
    return requireTether().saveSessionPoints(payload);
}

export async function getUserTotalPoints(_userId) {
    return requireTether().getUserTotalPoints();
}
