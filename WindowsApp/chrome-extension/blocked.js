const INTENTIONS = ["Check a message", "Post something", "Just looking"];
const BREATH_SECONDS = 4;
const BREATH_CYCLES = 3;
const VALID_MODES = new Set(["breathing", "reflect", "hard"]);

const appEl = document.getElementById("app");
const params = new URLSearchParams(window.location.search);
const host = params.get("host") || "this site";
let mode = params.get("mode") || "breathing";
if (!VALID_MODES.has(mode)) mode = "breathing";

let friction = { futureMessage: "", goals: [] };
let phase = mode === "hard" ? "hard" : "breathing";
let elapsed = 0;
let start = 0;

function siteName() {
    return host.replace(/^www\./, "");
}

function normalizeFriction(value = {}) {
    return {
        futureMessage: String(value.futureMessage || "").trim(),
        goals: Array.isArray(value.goals)
            ? value.goals.map((goal) => String(goal).trim()).filter(Boolean)
            : [],
    };
}

function hasFirmContext() {
    return !!friction.futureMessage && friction.goals.length > 0;
}

function normalizeTypedText(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
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
        phase = mode === "reflect" ? "message" : "intention";
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
            phase = mode === "reflect" ? "message" : "intention";
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

function renderMessageTyping() {
    appEl.textContent = "";

    const title = document.createElement("h1");
    title.className = "title";
    title.textContent = "Type your message to yourself";

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = `Before opening ${siteName()}, type the message you wrote during onboarding.`;

    const quote = document.createElement("div");
    quote.className = "message-quote";
    quote.textContent = friction.futureMessage;

    const input = document.createElement("textarea");
    input.className = "message-input";
    input.rows = 4;
    input.placeholder = "Type your message here";
    input.autofocus = true;

    const status = document.createElement("p");
    status.className = "message-status";
    status.textContent = "Match the message exactly to continue.";

    const next = button("primary", "Next", () => {
        phase = "goal";
        render();
    });
    next.disabled = true;

    input.addEventListener("input", () => {
        const matches = normalizeTypedText(input.value) === normalizeTypedText(friction.futureMessage);
        next.disabled = !matches;
        status.textContent = matches ? "Matched." : "Match the message exactly to continue.";
    });

    appEl.append(
        title,
        hint,
        quote,
        input,
        status,
        next,
        button("quiet", "Actually, not now", goBack)
    );
    input.focus();
}

function renderGoalReminder() {
    appEl.textContent = "";

    const title = document.createElement("h1");
    title.className = "title";
    title.textContent = friction.goals.length === 1 ? "Remember your goal" : "Remember your goals";

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "You said you wanted more of this:";

    const goals = document.createElement("div");
    goals.className = "goal-list";
    for (const goal of friction.goals) {
        const item = document.createElement("div");
        item.className = "goal-card";
        item.textContent = goal;
        goals.appendChild(item);
    }

    appEl.append(
        title,
        hint,
        goals,
        button("primary", `Continue to ${siteName()}`, continueThrough),
        button("quiet", "You're right, close it", goBack)
    );
}

function renderHard() {
    document.title = "Tether — Blocked";
    appEl.textContent = "";

    const lockWrap = document.createElement("div");
    lockWrap.className = "lock-wrap";
    lockWrap.innerHTML = `
        <svg class="lock-svg" viewBox="0 0 100 100" aria-hidden="true">
          <g>
            <path class="lock-shackle" d="M 30 44 A 23 25 0 0 1 76 44"></path>
          </g>
          <rect class="lock-body" x="22" y="44" width="64" height="42" rx="9"></rect>
          <circle class="lock-keyhole-top" cx="54" cy="60" r="7"></circle>
          <path class="lock-keyhole-bottom" d="M 50.16 62.9 L 57.84 62.9 L 61.68 76.76 L 46.32 76.76 Z"></path>
        </svg>
    `;

    const title = document.createElement("h1");
    title.className = "title";
    title.textContent = `${siteName()} is blocked`;

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "You set this to hard block. There is no way through until your session ends.";

    appEl.append(lockWrap, title, hint, button("primary", "Go back", goBack));
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
        if (!hasFirmContext()) {
            renderReflect();
            return;
        }
        if (phase === "message") {
            renderMessageTyping();
            return;
        }
        if (phase === "goal") {
            renderGoalReminder();
            return;
        }
        renderReflect();
        return;
    }
    renderIntention();
}

if (mode === "hard") {
    render();
} else {
    chrome.storage.local.get(["friction"], (data) => {
        friction = normalizeFriction(data.friction);
        render();
    });
}
