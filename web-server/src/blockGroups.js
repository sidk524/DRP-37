const { expandBlockTargets } = require("./expandBlockTargets");
const { DEFAULT_BLOCK_GROUPS, DEFAULT_BLOCK_GROUP_KEYS } = require("./blockGroupDefaults");

const BLOCK_GROUP_FIELDS = "id,user_id,name,system_key,targets,apps_blocked,domains_blocked,canonical_targets,expanded_apps_blocked,expanded_domains_blocked,process_tokens,created_at,updated_at";

const publicBlockGroup = (row) => ({
    id: row.id,
    name: row.name,
    systemKey: row.system_key,
    targets: row.targets || [],
    appsBlocked: row.apps_blocked || [],
    domainsBlocked: row.domains_blocked || [],
    canonicalTargets: row.canonical_targets || [],
    expandedAppsBlocked: row.expanded_apps_blocked || [],
    expandedDomainsBlocked: row.expanded_domains_blocked || [],
    processTokens: row.process_tokens || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
});

const expandGroupInputs = ({ targets = [], appsBlocked = [], domainsBlocked = [] }) => {
    return expandBlockTargets({ targets, appsBlocked, domainsBlocked });
};

const hasBlockableContent = (expanded) => {
    return expanded.appsBlocked.length > 0
        || expanded.domainsBlocked.length > 0
        || expanded.processTokens.length > 0;
};

const groupRowFromInputs = (userId, { name, targets, appsBlocked, domainsBlocked, systemKey = null }) => {
    const expanded = expandGroupInputs({ targets, appsBlocked, domainsBlocked });
    return {
        row: {
            user_id: userId,
            name,
            system_key: systemKey,
            targets,
            apps_blocked: appsBlocked,
            domains_blocked: domainsBlocked,
            canonical_targets: expanded.canonicalTargets,
            expanded_apps_blocked: expanded.appsBlocked,
            expanded_domains_blocked: expanded.domainsBlocked,
            process_tokens: expanded.processTokens
        },
        expanded
    };
};

const sortBlockGroups = (groups) => {
    const systemRank = new Map(DEFAULT_BLOCK_GROUP_KEYS.map((key, index) => [key, index]));
    return [...groups].sort((left, right) => {
        const leftRank = left.system_key != null ? systemRank.get(left.system_key) ?? 0 : DEFAULT_BLOCK_GROUP_KEYS.length;
        const rightRank = right.system_key != null ? systemRank.get(right.system_key) ?? 0 : DEFAULT_BLOCK_GROUP_KEYS.length;
        return leftRank - rightRank || left.name.localeCompare(right.name);
    });
};

const listBlockGroups = async (supabaseAdmin, userId) => {
    const { data, error } = await supabaseAdmin
        .from("block_groups")
        .select(BLOCK_GROUP_FIELDS)
        .eq("user_id", userId);

    if (error) throw error;
    return sortBlockGroups(data || []);
};

const ensureBlockGroups = async (supabaseAdmin, userId) => {
    const existing = await listBlockGroups(supabaseAdmin, userId);
    const existingKeys = new Set(existing.map((group) => group.system_key).filter(Boolean));
    const missing = DEFAULT_BLOCK_GROUPS.filter((group) => !existingKeys.has(group.systemKey));

    if (missing.length === 0) return existing;

    const rows = missing.map((group) => groupRowFromInputs(userId, group).row);
    const { error } = await supabaseAdmin
        .from("block_groups")
        .insert(rows)
        .select("id");

    if (error && error.code !== "23505") throw error;
    return listBlockGroups(supabaseAdmin, userId);
};

const getBlockGroup = async (supabaseAdmin, userId, groupId) => {
    const { data, error } = await supabaseAdmin
        .from("block_groups")
        .select(BLOCK_GROUP_FIELDS)
        .eq("id", groupId)
        .eq("user_id", userId)
        .maybeSingle();

    if (error) throw error;
    return data;
};

const createBlockGroup = async (supabaseAdmin, userId, { name, targets, appsBlocked, domainsBlocked }) => {
    const { row, expanded } = groupRowFromInputs(userId, { name, targets, appsBlocked, domainsBlocked });
    if (!hasBlockableContent(expanded)) {
        const error = new Error("At least one app or website is required");
        error.status = 400;
        throw error;
    }

    const { data, error } = await supabaseAdmin
        .from("block_groups")
        .insert(row)
        .select(BLOCK_GROUP_FIELDS)
        .single();

    if (error) throw error;
    return data;
};

const updateBlockGroup = async (supabaseAdmin, userId, groupId, { name, targets, appsBlocked, domainsBlocked }) => {
    const existing = await getBlockGroup(supabaseAdmin, userId, groupId);
    if (!existing) {
        const error = new Error("Block group not found");
        error.status = 404;
        throw error;
    }

    const merged = {
        name: name != null ? name : existing.name,
        targets: targets != null ? targets : existing.targets || [],
        appsBlocked: appsBlocked != null ? appsBlocked : existing.apps_blocked || [],
        domainsBlocked: domainsBlocked != null ? domainsBlocked : existing.domains_blocked || []
    };

    const { row, expanded } = groupRowFromInputs(userId, merged);
    if (!hasBlockableContent(expanded)) {
        const error = new Error("At least one app or website is required");
        error.status = 400;
        throw error;
    }

    const { data, error } = await supabaseAdmin
        .from("block_groups")
        .update({
            name: row.name,
            targets: row.targets,
            apps_blocked: row.apps_blocked,
            domains_blocked: row.domains_blocked,
            canonical_targets: row.canonical_targets,
            expanded_apps_blocked: row.expanded_apps_blocked,
            expanded_domains_blocked: row.expanded_domains_blocked,
            process_tokens: row.process_tokens,
            updated_at: new Date().toISOString()
        })
        .eq("id", groupId)
        .eq("user_id", userId)
        .select(BLOCK_GROUP_FIELDS)
        .single();

    if (error) throw error;
    return data;
};

const deleteBlockGroup = async (supabaseAdmin, userId, groupId) => {
    const existing = await getBlockGroup(supabaseAdmin, userId, groupId);
    if (!existing) {
        const error = new Error("Block group not found");
        error.status = 404;
        throw error;
    }
    if (existing.system_key) {
        const error = new Error("Default block groups cannot be deleted");
        error.status = 403;
        throw error;
    }

    const { error } = await supabaseAdmin
        .from("block_groups")
        .delete()
        .eq("id", groupId)
        .eq("user_id", userId);

    if (error) throw error;
};

module.exports = {
    BLOCK_GROUP_FIELDS,
    publicBlockGroup,
    ensureBlockGroups,
    listBlockGroups,
    getBlockGroup,
    createBlockGroup,
    updateBlockGroup,
    deleteBlockGroup
};
