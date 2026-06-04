const INTENTIONS = ["Check a message", "Post something", "Just looking"];
const BREATH_SECONDS = 4;
const BREATH_CYCLES = 3;

const appEl = document.getElementById("app");
const params = new URLSearchParams(window.location.search);
const host = params.get("host") || "this site";

let mode = "breathing";
let phase = "breathing";
let elapsed = 0;
let start = 0;

function siteName() {
    return host.replace(/^www\./, "");
}

function button(className, text, onClick) {
    const el = document.createElement("button");
    el.className = className;
    el.textContent = text;
    el.addEventListener("click", onClick);
    return el;
}

function goBack() {
    if (history.length > 1) {
        history.back();
    } else {
        window.location.href = "about:blank";
    }
}

async function continueThrough() {
    const response = await chrome.runtime.sendMessage({ type: "allow-host", host });
    if (response?.ok && response.url) {
        window.location.href = response.url;
    }
}

function renderBreathing() {
    appEl.textContent = "";

    const label = document.createElement("p");
    label.className = "app";
    label.textContent = `You're about to open ${siteName()}`;

    const stage = document.createElement("div");
    stage.className = "breath-stage";

    const circle = document.createElement("div");
    circle.className = "breath-circle";

    const breathLabel = document.createElement("span");
    breathLabel.className = "breath-label";
    breathLabel.textContent = "Breathe in";

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Take a breath before you scroll.";

    const ready = button("quiet hidden", "I'm ready ->", () => {
        phase = "intention";
        render();
    });

    circle.appendChild(breathLabel);
    stage.appendChild(circle);
    appEl.append(label, stage, hint, ready);

    function tick(now) {
        if (phase !== "breathing") return;
        if (!start) start = now;
        elapsed = (now - start) / 1000;
        const cycleLength = BREATH_SECONDS * 2;
        const cyclePos = elapsed % cycleLength;
        breathLabel.textContent = cyclePos < BREATH_SECONDS ? "Breathe in" : "Breathe out";
        if (elapsed >= cycleLength) ready.classList.remove("hidden");
        if (elapsed >= cycleLength * BREATH_CYCLES) {
            phase = "intention";
            render();
            return;
        }
        requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
}

function renderIntention() {
    appEl.textContent = "";

    const title = document.createElement("h1");
    title.className = "title";
    title.textContent = `Why are you opening ${siteName()}?`;

    const options = document.createElement("div");
    options.className = "options";
    for (const reason of INTENTIONS) {
        options.appendChild(button("chip", reason, continueThrough));
    }

    appEl.append(
        title,
        options,
        button("primary", `Continue to ${siteName()}`, continueThrough),
        button("quiet", "Actually, not now", goBack)
    );
}

function renderReflect() {
    appEl.textContent = "";

    const title = document.createElement("h1");
    title.className = "title";
    title.textContent = `Why are you opening ${siteName()}?`;

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Future you asked for this pause. Is this still worth it?";

    const options = document.createElement("div");
    options.className = "options";
    for (const reason of INTENTIONS) {
        options.appendChild(button("chip", reason, continueThrough));
    }

    appEl.append(
        hint,
        title,
        options,
        button("primary", `Continue to ${siteName()}`, continueThrough),
        button("quiet", "You're right, close it", goBack)
    );
}

function renderHard() {
    appEl.textContent = "";

    const lock = document.createElement("div");
    lock.className = "lock";
    lock.textContent = "LOCK";

    const title = document.createElement("h1");
    title.className = "title";
    title.textContent = `${siteName()} is blocked`;

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "You set this to hard block. There is no way through until your session ends.";

    appEl.append(lock, title, hint, button("primary", "Go back", goBack));
}

function render() {
    if (mode === "hard") {
        renderHard();
        return;
    }
    if (phase === "breathing") {
        renderBreathing();
        return;
    }
    if (mode === "reflect") {
        renderReflect();
        return;
    }
    renderIntention();
}

chrome.storage.local.get(["mode"], (data) => {
    mode = data.mode || "breathing";
    render();
});
