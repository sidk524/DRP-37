const INTENTIONS = ["Check a message", "Post something", "Just looking"];
const BREATH_SECONDS = 4;
const BREATH_CYCLES = 3;
const VALID_MODES = new Set(["breathing", "reflect", "hard"]);
const EXERCISE_TASKS = ["Run 1 km", "Do 50 pushups", "Do 50 sit-ups"];

const appEl = document.getElementById("app");
const params = new URLSearchParams(window.location.search);
const host = params.get("host") || "this site";
let mode = params.get("mode") || "breathing";
if (!VALID_MODES.has(mode)) mode = "breathing";

let friction = { futureMessage: "", goals: [] };
let phase = mode === "hard" ? "hard" : "breathing";
let elapsed = 0;
let start = 0;
let selectedExerciseTask = null;

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

function hasExerciseGoal() {
    return friction.goals.some((goal) => goal.trim().toLowerCase() === "exercise");
}

function pickExerciseTask() {
    if (!selectedExerciseTask) {
        selectedExerciseTask = EXERCISE_TASKS[Math.floor(Math.random() * EXERCISE_TASKS.length)];
    }
    return selectedExerciseTask;
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

function renderExerciseTask() {
    document.title = "Tether — Exercise first";
    appEl.textContent = "";

    const title = document.createElement("h1");
    title.className = "title";
    title.textContent = "Complete this first";

    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = `You wanted to exercise more. Before opening ${siteName()}, finish this:`;

    const task = document.createElement("div");
    task.className = "task-card";
    task.textContent = pickExerciseTask();

    appEl.append(
        title,
        hint,
        task,
        button("primary", "I've completed this", continueThrough),
        button("quiet", "Actually, not now", goBack)
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
    if (mode === "reflect") {
        if (hasExerciseGoal()) {
            renderExerciseTask();
            return;
        }
        renderReflect();
        return;
    }
    if (phase === "breathing") {
        renderBreathing();
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
