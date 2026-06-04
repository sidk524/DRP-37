const BRIDGE_URL = "http://127.0.0.1:17894/api/block-state";
const STREAM_URL = "http://127.0.0.1:17894/api/block-state/stream";
const RULE_ID_BASE = 1000;

let stream = null;
let pollTimer = null;
let lastStateKey = "";

function normalizeHost(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .split("/")[0]
        .split("?")[0]
        .replace(/:\d+$/, "");
}

function expandDomains(domains = []) {
    const hosts = new Set();
    for (const raw of domains) {
        const host = normalizeHost(raw);
        if (!host || !host.includes(".")) continue;
        hosts.add(host);
        if (host.startsWith("www.")) {
            hosts.add(host.slice(4));
        } else {
            hosts.add(`www.${host}`);
        }
    }
    return [...hosts];
}

function stateKey(state) {
    const hosts = expandDomains(state?.domains || []).sort().join(",");
    return `${state?.active ? "1" : "0"}:${hosts}:${state?.endsAt || 0}`;
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
        lastError: connected ? null : "Desktop app not reachable.",
    });
}

async function applyRules(state) {
    const key = stateKey(state);
    if (key === lastStateKey) return;

    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existing.map((rule) => rule.id);

    if (!state?.active || !state?.domains?.length) {
        await clearRules(true);
        return;
    }

    const hosts = expandDomains(state.domains);
    if (!hosts.length) {
        await clearRules(true);
        return;
    }

    const addRules = hosts.map((host, index) => ({
        id: RULE_ID_BASE + index,
        priority: 1,
        action: {
            type: "redirect",
            redirect: { extensionPath: "/blocked.html" },
        },
        condition: {
            urlFilter: `||${host}^`,
            resourceTypes: ["main_frame"],
        },
    }));

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
            endsAt: state.endsAt,
            mode: state.mode,
            lastError: null,
        });
    } catch (error) {
        lastStateKey = "";
        await chrome.storage.local.set({
            connected: true,
            blocking: false,
            domains: state.domains,
            hosts,
            lastError: error.message || "Could not apply browser blocking rules.",
        });
    }
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

connectStream();
startPolling();
syncFromDesktop();
