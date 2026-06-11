const targets = new Map();

function normalizeList(values = []) {
    return Array.from(
        new Set(
            values
                .map((value) => String(value || "").trim().toLowerCase())
                .filter(Boolean)
        )
    ).sort();
}

function registerTarget(entry) {
    const id = String(entry?.id || "").trim().toLowerCase();
    if (!id) throw new Error("Target id is required.");

    const existing = targets.get(id) || {
        id,
        packages: [],
        domains: [],
        processTokens: [],
        aliases: []
    };

    targets.set(id, {
        id,
        packages: normalizeList([...existing.packages, ...(entry.packages || [])]),
        domains: normalizeList([...existing.domains, ...(entry.domains || [])]),
        processTokens: normalizeList([...existing.processTokens, ...(entry.processTokens || [])]),
        aliases: normalizeList([...existing.aliases, ...(entry.aliases || [])])
    });
}

[
    {
        id: "instagram",
        packages: ["com.instagram.android"],
        domains: ["instagram.com", "www.instagram.com"],
        processTokens: ["instagram"],
        aliases: ["ig"]
    },
    {
        id: "tiktok",
        packages: ["com.zhiliaoapp.musically", "com.ss.android.ugc.trill"],
        domains: ["tiktok.com", "www.tiktok.com"],
        processTokens: ["tiktok"],
        aliases: ["tik tok"]
    },
    {
        id: "youtube",
        packages: ["com.google.android.youtube"],
        domains: ["youtube.com", "www.youtube.com", "m.youtube.com"],
        processTokens: ["youtube"],
        aliases: ["yt"]
    },
    {
        id: "x",
        packages: ["com.twitter.android"],
        domains: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
        processTokens: ["x", "twitter", "tweetdeck"],
        aliases: ["twitter", "tweetdeck"]
    },
    {
        id: "reddit",
        packages: ["com.reddit.frontpage"],
        domains: ["reddit.com", "www.reddit.com", "old.reddit.com"],
        processTokens: ["reddit"]
    },
    {
        id: "facebook",
        packages: ["com.facebook.katana"],
        domains: ["facebook.com", "www.facebook.com", "m.facebook.com"],
        processTokens: ["facebook", "fb"],
        aliases: ["fb"]
    },
    {
        id: "snapchat",
        packages: ["com.snapchat.android"],
        domains: ["snapchat.com", "www.snapchat.com"],
        processTokens: ["snapchat"]
    },
    {
        id: "netflix",
        packages: ["com.netflix.mediaclient"],
        domains: ["netflix.com", "www.netflix.com"],
        processTokens: ["netflix"]
    },
    {
        id: "discord",
        packages: ["com.discord"],
        domains: ["discord.com", "www.discord.com", "discordapp.com"],
        processTokens: ["discord"]
    },
    {
        id: "twitch",
        packages: ["tv.twitch.android.app"],
        domains: ["twitch.tv", "www.twitch.tv"],
        processTokens: ["twitch"]
    },
    {
        id: "whatsapp",
        packages: ["com.whatsapp"],
        domains: ["web.whatsapp.com", "whatsapp.com", "www.whatsapp.com"],
        processTokens: ["whatsapp"]
    },
    {
        id: "messenger",
        packages: ["com.facebook.orca"],
        domains: ["messenger.com", "www.messenger.com"],
        processTokens: ["messenger"],
        aliases: ["facebook messenger"]
    },
    {
        id: "telegram",
        packages: ["org.telegram.messenger"],
        domains: ["telegram.org", "www.telegram.org", "web.telegram.org"],
        processTokens: ["telegram"]
    },
    {
        id: "primevideo",
        packages: ["com.amazon.avod.thirdpartyclient"],
        domains: ["primevideo.com", "www.primevideo.com"],
        processTokens: ["primevideo"],
        aliases: ["prime video", "amazon prime video"]
    },
    {
        id: "notepad",
        packages: [],
        domains: [],
        processTokens: ["notepad"],
        aliases: ["notepad test"]
    }
].forEach(registerTarget);

function getTargets() {
    return Array.from(targets.values());
}

module.exports = {
    getTargets,
    registerTarget
};
