(function attachSessionDisplay(global) {
    const MODE_STRICTNESS = {
        breathing: {
            label: "Gentle nudges",
            icon: "🌱",
            tint: "gentle",
            description: "Gentle: a short breathing pause, then you can continue.",
        },
        reflect: {
            label: "Firm friction",
            icon: "🔒",
            tint: "firm",
            description: "Firm: 10s pause + intention check. You can still get through.",
        },
        hard: {
            label: "Hard block",
            icon: "⛔",
            tint: "hard",
            description: "Hard: no way through until your session ends.",
        },
    };

    function modeToStrictness(mode) {
        return MODE_STRICTNESS[mode] || MODE_STRICTNESS.reflect;
    }

    function formatBlockGroupLabel(blockGroupName) {
        const name = String(blockGroupName || "").trim();
        if (!name) return "Block group";
        return `Block group · ${name}`;
    }

    function formatSessionEndTime(endsAt) {
        if (!endsAt) return "Blocking active websites";
        const date = new Date(endsAt);
        if (Number.isNaN(date.getTime())) return "Blocking active websites";
        return `Blocking until ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    }

    function formatRemainingTime(endsAt, now = Date.now()) {
        if (!endsAt) return "";
        const remainingMs = Math.max(0, endsAt - now);
        const totalSeconds = Math.floor(remainingMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (hours > 0) {
            return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s left`;
        }
        if (minutes > 0) {
            return `${minutes}m ${String(seconds).padStart(2, "0")}s left`;
        }
        return `${seconds}s left`;
    }

    global.TetherSessionDisplay = {
        MODE_STRICTNESS,
        modeToStrictness,
        formatBlockGroupLabel,
        formatSessionEndTime,
        formatRemainingTime,
    };
})(typeof globalThis !== "undefined" ? globalThis : window);
