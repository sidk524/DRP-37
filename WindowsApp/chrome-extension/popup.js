const {
    modeToStrictness,
    formatBlockGroupLabel,
    formatSessionEndTime,
    formatRemainingTime,
} = TetherSessionDisplay;

const connectionEl = document.getElementById("connection");
const connectionLabelEl = document.getElementById("connection-label");
const errorPanelEl = document.getElementById("error-panel");
const idlePanelEl = document.getElementById("idle-panel");
const activePanelEl = document.getElementById("active-panel");
const blockGroupLabelEl = document.getElementById("block-group-label");
const strictnessCardEl = document.getElementById("strictness-card");
const strictnessIconEl = document.getElementById("strictness-icon");
const strictnessLabelEl = document.getElementById("strictness-label");
const sessionMetaEl = document.getElementById("session-meta");

const STORAGE_KEYS = [
    "connected",
    "blocking",
    "endsAt",
    "mode",
    "blockGroupId",
    "blockGroupName",
    "lastError",
];

function hideAllPanels() {
    errorPanelEl.classList.add("hidden");
    idlePanelEl.classList.add("hidden");
    activePanelEl.classList.add("hidden");
}

function renderStrictness(mode) {
    const strictness = modeToStrictness(mode);
    strictnessCardEl.className = `strictness-card strictness-${strictness.tint} tether-readonly selected`;
    strictnessIconEl.textContent = strictness.icon;
    strictnessLabelEl.textContent = strictness.label;
}

function renderPopup(data) {
    hideAllPanels();

    if (!data.connected) {
        connectionEl.classList.remove("hidden");
        connectionEl.classList.add("is-error");
        connectionLabelEl.textContent = "Desktop app offline";
        errorPanelEl.textContent =
            data.lastError || "Desktop app not reachable. Start Tether with npm run dev.";
        errorPanelEl.classList.remove("hidden");
        return;
    }

    connectionEl.classList.remove("hidden", "is-error");
    connectionLabelEl.textContent = "Connected to desktop app";

    if (data.lastError) {
        errorPanelEl.textContent = data.lastError;
        errorPanelEl.classList.remove("hidden");
        return;
    }

    if (!data.blocking) {
        idlePanelEl.classList.remove("hidden");
        return;
    }

    activePanelEl.classList.remove("hidden");
    blockGroupLabelEl.textContent = formatBlockGroupLabel(data.blockGroupName);
    renderStrictness(data.mode || "reflect");

    const remaining = formatRemainingTime(data.endsAt);
    const endLabel = formatSessionEndTime(data.endsAt);
    sessionMetaEl.textContent = remaining ? `${remaining} · ${endLabel}` : endLabel;
}

function loadPopupState() {
    chrome.storage.local.get(STORAGE_KEYS, renderPopup);
}

loadPopupState();
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!STORAGE_KEYS.some((key) => key in changes)) return;
    loadPopupState();
});

setInterval(() => {
    chrome.storage.local.get(["blocking", "endsAt"], (data) => {
        if (!data.blocking || !data.endsAt) return;
        const remaining = formatRemainingTime(data.endsAt);
        const endLabel = formatSessionEndTime(data.endsAt);
        if (sessionMetaEl.textContent) {
            sessionMetaEl.textContent = remaining ? `${remaining} · ${endLabel}` : endLabel;
        }
    });
}, 1000);
