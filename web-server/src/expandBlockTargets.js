const { getTargets } = require("./blockTargetRegistry");

function normalizeToken(value) {
    return String(value || "").trim().toLowerCase();
}

function normalizeHost(value) {
    return normalizeToken(value)
        .replace(/^https?:\/\//, "")
        .split("/")[0]
        .split("?")[0]
        .replace(/:\d+$/, "");
}

function normalizeDomain(value) {
    return normalizeHost(value).replace(/^www\./, "");
}

function isDomain(value) {
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(value);
}

function isPackage(value) {
    return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(value) && !isDomain(value);
}

function addAll(target, values) {
    for (const value of values) {
        const normalized = normalizeToken(value);
        if (normalized) target.add(normalized);
    }
}

function buildIndexes() {
    const byId = new Map();
    const byPackage = new Map();
    const byDomain = new Map();
    const byAlias = new Map();

    for (const target of getTargets()) {
        byId.set(target.id, target);
        for (const pkg of target.packages) byPackage.set(normalizeToken(pkg), target);
        for (const domain of target.domains) {
            byDomain.set(normalizeHost(domain), target);
            byDomain.set(normalizeDomain(domain), target);
        }
        for (const alias of target.aliases) byAlias.set(normalizeToken(alias), target);
    }

    return { byId, byPackage, byDomain, byAlias };
}

function expandBlockTargets({ appsBlocked = [], domainsBlocked = [], targets = [] } = {}) {
    const indexes = buildIndexes();
    const canonicalTargets = new Set();
    const apps = new Set();
    const domains = new Set();
    const processTokens = new Set();

    function applyTarget(target) {
        canonicalTargets.add(target.id);
        addAll(apps, target.packages);
        for (const domain of target.domains) {
            const normalized = normalizeHost(domain);
            if (normalized) domains.add(normalized);
        }
        addAll(processTokens, target.processTokens);
    }

    function applyInput(value, nativeType) {
        const normalized = nativeType === "domain"
            ? normalizeDomain(value)
            : normalizeToken(value);
        if (!normalized) return;

        const match = indexes.byId.get(normalized)
            || indexes.byAlias.get(normalized)
            || indexes.byPackage.get(normalized)
            || indexes.byDomain.get(normalizeDomain(normalized));

        if (match) {
            applyTarget(match);
            return;
        }

        if (nativeType === "package" || isPackage(normalized)) {
            apps.add(normalized);
            return;
        }

        if (nativeType === "domain" || isDomain(normalized)) {
            domains.add(normalizeDomain(normalized));
        }
    }

    for (const value of targets) applyInput(value);
    for (const value of appsBlocked) applyInput(value, "package");
    for (const value of domainsBlocked) applyInput(value, "domain");

    return {
        canonicalTargets: Array.from(canonicalTargets).sort(),
        appsBlocked: Array.from(apps).sort(),
        domainsBlocked: Array.from(domains).sort(),
        processTokens: Array.from(processTokens).sort()
    };
}

module.exports = {
    expandBlockTargets,
    normalizeDomain
};
