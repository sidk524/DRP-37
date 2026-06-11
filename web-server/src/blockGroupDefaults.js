const DEFAULT_BLOCK_GROUPS = [
    {
        systemKey: "social_media",
        name: "Social media",
        targets: ["instagram", "tiktok", "youtube", "facebook", "x", "reddit"],
        appsBlocked: [],
        domainsBlocked: []
    },
    {
        systemKey: "messaging",
        name: "Messaging",
        targets: ["whatsapp", "discord", "messenger", "telegram"],
        appsBlocked: [],
        domainsBlocked: []
    },
    {
        systemKey: "streaming",
        name: "Streaming",
        targets: ["youtube", "netflix", "twitch", "primevideo"],
        appsBlocked: [],
        domainsBlocked: []
    }
];

const DEFAULT_BLOCK_GROUP_KEYS = DEFAULT_BLOCK_GROUPS.map((group) => group.systemKey);

module.exports = {
    DEFAULT_BLOCK_GROUPS,
    DEFAULT_BLOCK_GROUP_KEYS
};
