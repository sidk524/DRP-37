function requireTether() {
    if (typeof window === "undefined" || !window.tether) {
        throw new Error("Tether desktop API is not available.");
    }
    return window.tether;
}

const VALID_STRICTNESS = new Set(["gentle", "moderate", "hard"]);

function normalizeNonEmptyStringArray(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
}

function normalizeOnboarding(settings) {
    if (!settings || typeof settings !== "object") return null;
    const strictness = VALID_STRICTNESS.has(settings.strictness)
        ? settings.strictness
        : "moderate";
    return {
        doMoreOf: normalizeNonEmptyStringArray(settings.doMoreOf),
        scrollingWorst: normalizeNonEmptyStringArray(settings.scrollingWorst),
        futureMessage: String(settings.futureMessage || "").trim(),
        strictness,
    };
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
    const settings = await requireTether().loadOnboarding();
    return normalizeOnboarding(settings);
}

export async function saveOnboarding(_userId, responses) {
    const saved = await requireTether().saveOnboarding(responses);
    return normalizeOnboarding(saved);
}

export async function saveSessionPoints(payload) {
    return requireTether().saveSessionPoints(payload);
}

export async function getUserTotalPoints(_userId) {
    return requireTether().getUserTotalPoints();
}
