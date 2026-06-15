const BRIDGE_URL = "http://127.0.0.1:17894/api/block-state";
const STREAM_URL = "http://127.0.0.1:17894/api/block-state/stream";
const RULE_ID_BASE = 1000;
const CONTINUE_GRACE_MS = 2500;
const BLOCKED_PAGE = "blocked.html";

const DOMAIN_GROUPS = [
    ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
    ["instagram.com", "www.instagram.com"],
    ["reddit.com", "www.reddit.com", "old.reddit.com"],
    ["youtube.com", "www.youtube.com", "m.youtube.com"],
    ["facebook.com", "www.facebook.com"],
    ["tiktok.com", "www.tiktok.com"],
    ["netflix.com", "www.netflix.com"],
];

let stream = null;
let pollTimer = null;
let lastStateKey = "";
let currentState = { active: false, domains: [], mode: "breathing", friction: {} };

function normalizeHost(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .split("/")[0]
        .split("?")[0]
        .replace(/:\d+$/, "");
}

function apexHost(host) {
    return host.startsWith("www.") ? host.slice(4) : host;
}

function expandDomains(domains = []) {
    const hosts = new Set();
    const normalized = domains.map(normalizeHost).filter((host) => host && host.includes("."));

    for (const host of normalized) {
        hosts.add(host);
        if (host.startsWith("www.")) {
            hosts.add(host.slice(4));
        } else {
            hosts.add(`www.${host}`);
        }
    }

    for (const group of DOMAIN_GROUPS) {
        const groupHosts = new Set(group.map(normalizeHost));
        const matchesGroup = normalized.some((host) => groupHosts.has(host) || groupHosts.has(apexHost(host)));
        if (matchesGroup) {
            for (const groupHost of groupHosts) {
                hosts.add(groupHost);
            }
        }
    }

    return [...hosts];
}

function blockPagePath(host, mode = "breathing") {
    const safeMode = ["breathing", "reflect", "hard"].includes(mode) ? mode : "breathing";
    return `/${BLOCKED_PAGE}?host=${encodeURIComponent(host)}&mode=${encodeURIComponent(safeMode)}`;
}

function blockPageFullUrl(host, mode = "breathing") {
    return chrome.runtime.getURL(blockPagePath(host, mode).replace(/^\//, ""));
}

function normalizeFriction(friction = {}) {
    return {
        futureMessage: String(friction.futureMessage || "").trim(),
        goals: Array.isArray(friction.goals)
            ? friction.goals.map((goal) => String(goal).trim()).filter(Boolean)
            : [],
    };
}

function blockedPageUrl() {
    return chrome.runtime.getURL(BLOCKED_PAGE);
}

function isBlockedPageUrl(url) {
    return typeof url === "string" && url.startsWith(blockedPageUrl());
}

function stateKey(state) {
    const hosts = expandDomains(state?.domains || []).sort().join(",");
    const friction = normalizeFriction(state?.friction);
    return `${state?.active ? "1" : "0"}:${hosts}:${state?.endsAt || 0}:${state?.mode || "breathing"}:${state?.blockGroupId || ""}:${state?.blockGroupName || ""}:${JSON.stringify(friction)}`;
}

async function getAllowedUntil() {
    const data = await chrome.storage.local.get(["allowedUntil"]);
    return data.allowedUntil || {};
}

async function setAllowedUntil(allowedUntil) {
    await chrome.storage.local.set({ allowedUntil });
}

async function activeHostsForState(state) {
    const now = Date.now();
    const allowedUntil = await getAllowedUntil();
    let changed = false;
    for (const [host, until] of Object.entries(allowedUntil)) {
        if (!Number.isFinite(until) || until <= now) {
            delete allowedUntil[host];
            changed = true;
        }
    }
    if (changed) await setAllowedUntil(allowedUntil);
    return expandDomains(state.domains).filter((host) => (allowedUntil[host] || 0) <= now);
}

async function fetchState() {
    const res = await fetch(BRIDGE_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function clearRules(connected) {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existing.map((rule) => rule.id);
    if (removeRuleIds.length) {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds,
            addRules: [],
        });
    }
    lastStateKey = "";
    await chrome.storage.local.set({
        connected,
        blocking: false,
        domains: [],
        hosts: [],
        rules: [],
        endsAt: null,
        mode: "breathing",
        blockGroupId: null,
        blockGroupName: null,
        friction: normalizeFriction(),
        lastError: connected ? null : "Desktop app not reachable.",
    });
}

function buildBlockRule(host, mode, index) {
    return {
        id: RULE_ID_BASE + index,
        priority: 1,
        action: {
            type: "redirect",
            redirect: { extensionPath: blockPagePath(host, mode) },
        },
        condition: {
            urlFilter: `||${host}^`,
            resourceTypes: ["main_frame"],
        },
    };
}

async function applyRules(state) {
    currentState = state || { active: false, domains: [], mode: "breathing", friction: {} };
    const mode = currentState.mode || "breathing";
    const friction = normalizeFriction(currentState.friction);
    const hosts = state?.active && state?.domains?.length ? await activeHostsForState(state) : [];
    const key = `${stateKey(state)}:${hosts.sort().join(",")}`;
    if (key === lastStateKey) return;

    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existing.map((rule) => rule.id);

    if (!state?.active || !state?.domains?.length) {
        await clearRules(true);
        return;
    }

    if (!hosts.length) {
        await clearRules(true);
        return;
    }

    const addRules = hosts.map((host, index) => buildBlockRule(host, mode, index));

    try {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: removeRuleIds.length ? removeRuleIds : [],
            addRules,
        });
        lastStateKey = key;
        await chrome.storage.local.set({
            connected: true,
            blocking: true,
            domains: state.domains,
            hosts,
            rules: addRules.map((rule) => ({
                id: rule.id,
                domain: rule.condition.urlFilter.replace(/^\|\|/, "").replace(/\^$/, ""),
            })),
            endsAt: state.endsAt,
            mode,
            blockGroupId: state.blockGroupId || null,
            blockGroupName: state.blockGroupName || null,
            friction,
            lastError: null,
        });
    } catch (error) {
        lastStateKey = "";
        await chrome.storage.local.set({
            connected: true,
            blocking: false,
            domains: state.domains,
            hosts,
            mode,
            blockGroupId: state.blockGroupId || null,
            blockGroupName: state.blockGroupName || null,
            friction,
            lastError: error.message || "Could not apply browser blocking rules.",
        });
    }
}

async function allowHost(host) {
    if (currentState.mode === "hard") {
        return { ok: false, error: "hard-blocked" };
    }
    const normalized = normalizeHost(host);
    if (!normalized) return { ok: false };
    const allowedUntil = await getAllowedUntil();
    for (const expanded of expandDomains([normalized])) {
        allowedUntil[expanded] = Date.now() + CONTINUE_GRACE_MS;
    }
    await setAllowedUntil(allowedUntil);
    lastStateKey = "";
    await applyRules(currentState);
    setTimeout(() => {
        lastStateKey = "";
        syncFromDesktop();
    }, CONTINUE_GRACE_MS + 500);
    return { ok: true, url: `https://${normalized}/` };
}

async function maybeRedirectTab(tabId, url) {
    if (!url || isBlockedPageUrl(url)) return;
    if (url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:")) return;

    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return;
    }

    if (!currentState?.active || !currentState?.domains?.length) return;

    const host = normalizeHost(parsed.hostname);
    const blockedHosts = new Set(await activeHostsForState(currentState));
    if (!blockedHosts.has(host)) return;

    await chrome.tabs.update(tabId, {
        url: blockPageFullUrl(host, currentState.mode || "breathing"),
    });
}

async function syncFromDesktop() {
    try {
        const state = await fetchState();
        await applyRules(state);
    } catch {
        await clearRules(false);
    }
}

function connectStream() {
    if (typeof EventSource === "undefined") return;
    if (stream) {
        stream.close();
        stream = null;
    }
    stream = new EventSource(STREAM_URL);
    stream.onmessage = (event) => {
        try {
            applyRules(JSON.parse(event.data));
        } catch {
            syncFromDesktop();
        }
    };
    stream.onerror = () => {
        if (stream) {
            stream.close();
            stream = null;
        }
        syncFromDesktop();
    };
}

function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => syncFromDesktop(), 3000);
}

chrome.runtime.onStartup.addListener(() => {
    connectStream();
    startPolling();
    syncFromDesktop();
});

chrome.runtime.onInstalled.addListener(() => {
    connectStream();
    startPolling();
    syncFromDesktop();
});

chrome.alarms.create("tether-sync", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "tether-sync") syncFromDesktop();
});

chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0) return;
    maybeRedirectTab(details.tabId, details.url);
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (details.frameId !== 0) return;
    maybeRedirectTab(details.tabId, details.url);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "allow-host") return false;
    allowHost(message.host).then(sendResponse);
    return true;
});

connectStream();
startPolling();
syncFromDesktop();
