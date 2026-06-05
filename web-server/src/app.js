const express = require("express");
const helmet = require("helmet");
const { randomInt } = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");
const { expandBlockTargets } = require("./expandBlockTargets");

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

const supabaseClientOptions = {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    },
    realtime: {
        transport: ws
    }
};

const supabaseAuth = supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey, supabaseClientOptions)
    : null;

const supabaseAdmin = supabaseUrl && supabaseSecretKey
    ? createClient(supabaseUrl, supabaseSecretKey, supabaseClientOptions)
    : null;

const app = express();
const SESSION_FIELDS = "id,user_id,canonical_targets,apps_blocked,domains_blocked,process_tokens,total_duration_seconds,started_at,ended_at";
const GROUP_FIELDS = "id,name,invite_code,created_by,created_at";
const DEFAULT_GROUP_FIELDS = `${GROUP_FIELDS},default_group_key`;
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_GROUPS = [
    { key: "late_night", label: "Late night", name: "Late night", inviteCode: "LATENITE" },
    { key: "first_thing_morning", label: "First thing morning", name: "First thing morning", inviteCode: "MORNING1" },
    { key: "meals", label: "Meals", name: "Meals", inviteCode: "MEALS000" },
    { key: "work_hours", label: "Work hours", name: "Work hours", inviteCode: "WORKHOUR" }
];
const DEFAULT_GROUP_LABELS = new Map(DEFAULT_GROUPS.map((group) => [group.label, group]));

app.disable("x-powered-by");
app.use(helmet());
app.use((req, res, next) => {
    const origin = req.get("origin");
    if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type,Accept");
    if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
    }
    next();
});
app.use(express.json());

app.get("/", (_req, res) => {
    res.json({
        name: "DRP-37 web server",
        status: "ok"
    });
});

app.get("/health", (_req, res) => {
    res.type("text").send("VERY HEALTHY");
});

const requireSupabase = (_req, res, next) => {
    if (!supabaseAuth || !supabaseAdmin) {
        res.status(503).json({ error: "Supabase is not configured" });
        return;
    }
    next();
};

const requireUser = async (req, res, next) => {
    try {
        const authHeader = req.get("authorization") || "";
        const [scheme, token] = authHeader.split(" ");

        if (scheme !== "Bearer" || !token) {
            res.status(401).json({ error: "Missing bearer token" });
            return;
        }

        const { data, error } = await supabaseAuth.auth.getUser(token);
        if (error || !data.user) {
            res.status(401).json({ error: "Invalid bearer token" });
            return;
        }

        req.user = data.user;
        next();
    } catch (error) {
        next(error);
    }
};

const isExpired = (session, now = new Date()) => {
    const startedAt = new Date(session.started_at);
    const expiresAt = new Date(startedAt.getTime() + session.total_duration_seconds * 1000);
    return Number.isNaN(expiresAt.getTime()) || expiresAt <= now;
};

const closeSession = async (userId, sessionId = null) => {
    let query = supabaseAdmin
        .from("block_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("ended_at", null);

    if (sessionId) {
        query = query.eq("id", sessionId);
    }

    return query.select(SESSION_FIELDS);
};

const createSession = async (userId, expandedTargets, totalDurationSeconds) => {
    return supabaseAdmin
        .from("block_sessions")
        .insert({
            user_id: userId,
            canonical_targets: expandedTargets.canonicalTargets,
            apps_blocked: expandedTargets.appsBlocked,
            domains_blocked: expandedTargets.domainsBlocked,
            process_tokens: expandedTargets.processTokens,
            total_duration_seconds: totalDurationSeconds,
            started_at: new Date().toISOString()
        })
        .select(SESSION_FIELDS)
        .single();
};

const validateStringArray = (value, fieldName) => {
    if (value == null) return [];
    if (!Array.isArray(value)) {
        return { error: `${fieldName} must be an array` };
    }
    if (value.some((item) => typeof item !== "string" || !item.trim())) {
        return { error: `${fieldName} must contain non-empty strings` };
    }
    return value;
};

const makeHttpError = (status, message) => {
    const error = new Error(message);
    error.status = status;
    return error;
};

const missingSchemaError = (error) => {
    const message = String(error?.message || "");
    if (error?.code === "PGRST204" && /default_group_key/i.test(message)) {
        return makeHttpError(503, "Default groups are not available. Run Supabase migration 005_default_leaderboard_groups.sql.");
    }
    if (!["PGRST205", "42P01"].includes(error?.code)) return null;
    if (!/(leaderboard_groups|group_members)/i.test(message)) return null;
    return makeHttpError(503, "Group tables are not available. Run Supabase migration 003_leaderboard_groups.sql.");
};

const generateInviteCode = () => {
    let code = "";
    for (let index = 0; index < 8; index += 1) {
        code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
    }
    return code;
};

const normalizeInviteCode = (value) => String(value || "").trim().toUpperCase().replace(/\s+/g, "");

const publicGroup = (group, memberCount = 1) => ({
    id: group.id,
    name: group.name,
    inviteCode: group.invite_code,
    createdBy: group.created_by,
    createdAt: group.created_at,
    memberCount
});

const createGroupWithInvite = async (userId, name) => {
    let lastError = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const { data, error } = await supabaseAdmin
            .from("leaderboard_groups")
            .insert({
                name,
                invite_code: generateInviteCode(),
                created_by: userId
            })
            .select(GROUP_FIELDS)
            .single();

        if (!error) return data;
        lastError = error;
        if (error.code !== "23505") throw error;
    }
    throw lastError || new Error("Could not create a unique invite code");
};

const ensureGroupMember = async (groupId, userId) => {
    const { error } = await supabaseAdmin
        .from("group_members")
        .insert({
            group_id: groupId,
            user_id: userId
        })
        .select("id")
        .maybeSingle();

    if (error && error.code !== "23505") throw error;
};

const ensureDefaultGroups = async () => {
    const defaultKeys = DEFAULT_GROUPS.map((group) => group.key);
    const { data: existingGroups, error: existingError } = await supabaseAdmin
        .from("leaderboard_groups")
        .select(DEFAULT_GROUP_FIELDS)
        .in("default_group_key", defaultKeys);

    if (existingError) throw existingError;

    const existingKeys = new Set((existingGroups || []).map((group) => group.default_group_key));
    const missingGroups = DEFAULT_GROUPS
        .filter((group) => !existingKeys.has(group.key))
        .map((group) => ({
            name: group.name,
            invite_code: group.inviteCode,
            created_by: null,
            default_group_key: group.key
        }));

    if (missingGroups.length > 0) {
        const { error: insertError } = await supabaseAdmin
            .from("leaderboard_groups")
            .insert(missingGroups)
            .select("id");

        if (insertError && insertError.code !== "23505") throw insertError;
    }

    const { data: defaultGroups, error: finalError } = await supabaseAdmin
        .from("leaderboard_groups")
        .select(DEFAULT_GROUP_FIELDS)
        .in("default_group_key", defaultKeys);

    if (finalError) throw finalError;
    return defaultGroups || [];
};

const listUserGroups = async (userId) => {
    const { data: memberships, error: membershipError } = await supabaseAdmin
        .from("group_members")
        .select("group_id")
        .eq("user_id", userId);

    if (membershipError) throw membershipError;
    const groupIds = [...new Set((memberships || []).map((membership) => membership.group_id).filter(Boolean))];
    if (!groupIds.length) return [];

    const { data: groups, error: groupsError } = await supabaseAdmin
        .from("leaderboard_groups")
        .select(GROUP_FIELDS)
        .in("id", groupIds);

    if (groupsError) throw groupsError;

    const { data: allMembers, error: membersError } = await supabaseAdmin
        .from("group_members")
        .select("group_id")
        .in("group_id", groupIds);

    if (membersError) throw membersError;

    const memberCounts = new Map();
    for (const member of allMembers || []) {
        memberCounts.set(member.group_id, (memberCounts.get(member.group_id) || 0) + 1);
    }

    return (groups || [])
        .map((group) => publicGroup(group, memberCounts.get(group.id) || 0))
        .sort((left, right) => left.name.localeCompare(right.name));
};

const assertGroupMember = async (groupId, userId) => {
    const { data, error } = await supabaseAdmin
        .from("group_members")
        .select("id")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw makeHttpError(403, "You are not a member of this group");
};

const groupMemberCount = async (groupId) => {
    const { data, error } = await supabaseAdmin
        .from("group_members")
        .select("id")
        .eq("group_id", groupId);

    if (error) throw error;
    return (data || []).length;
};

const syncDefaultGroupMemberships = async (userId, selectedLabels) => {
    const selectedKeys = new Set(selectedLabels.map((label) => DEFAULT_GROUP_LABELS.get(label).key));
    const defaultGroups = await ensureDefaultGroups();
    const defaultGroupIds = defaultGroups.map((group) => group.id);

    if (!defaultGroupIds.length) return listUserGroups(userId);

    const { data: memberships, error: membershipsError } = await supabaseAdmin
        .from("group_members")
        .select("id,group_id")
        .eq("user_id", userId)
        .in("group_id", defaultGroupIds);

    if (membershipsError) throw membershipsError;

    const membershipsByGroupId = new Map((memberships || []).map((membership) => [membership.group_id, membership]));
    const defaultGroupsById = new Map(defaultGroups.map((group) => [group.id, group]));

    for (const group of defaultGroups) {
        if (selectedKeys.has(group.default_group_key) && !membershipsByGroupId.has(group.id)) {
            await ensureGroupMember(group.id, userId);
        }
    }

    for (const membership of memberships || []) {
        const group = defaultGroupsById.get(membership.group_id);
        if (!group || selectedKeys.has(group.default_group_key)) continue;
        const { error } = await supabaseAdmin
            .from("group_members")
            .delete()
            .eq("id", membership.id)
            .eq("user_id", userId);

        if (error) throw error;
    }

    return listUserGroups(userId);
};

const lockedSecondsForSession = (session) => {
    const startedAt = new Date(session.started_at).getTime();
    const endedAt = new Date(session.ended_at).getTime();
    if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt <= startedAt) return 0;
    const elapsedSeconds = Math.floor((endedAt - startedAt) / 1000);
    const plannedSeconds = Number(session.total_duration_seconds);
    if (!Number.isFinite(plannedSeconds) || plannedSeconds <= 0) return Math.max(0, elapsedSeconds);
    return Math.max(0, Math.min(elapsedSeconds, plannedSeconds));
};

const displayNameForUser = async (userId) => {
    const getUserById = supabaseAdmin.auth?.admin?.getUserById;
    if (!getUserById) return "User";
    const { data, error } = await getUserById(userId);
    if (error) return "User";
    const user = data?.user;
    return user?.user_metadata?.name
        || user?.user_metadata?.full_name
        || user?.email?.split("@")[0]
        || "User";
};

app.post("/api/groups", requireSupabase, requireUser, async (req, res, next) => {
    try {
        const name = String(req.body?.name || "").trim();
        if (!name) {
            res.status(400).json({ error: "name is required" });
            return;
        }
        if (name.length > 80) {
            res.status(400).json({ error: "name must be 80 characters or fewer" });
            return;
        }

        const group = await createGroupWithInvite(req.user.id, name);
        await ensureGroupMember(group.id, req.user.id);
        res.status(201).json({ group: publicGroup(group, 1) });
    } catch (error) {
        next(error);
    }
});

app.get("/api/groups", requireSupabase, requireUser, async (req, res, next) => {
    try {
        const groups = await listUserGroups(req.user.id);
        res.json({ groups });
    } catch (error) {
        next(error);
    }
});

app.post("/api/groups/join", requireSupabase, requireUser, async (req, res, next) => {
    try {
        const inviteCode = normalizeInviteCode(req.body?.inviteCode);
        if (!inviteCode) {
            res.status(400).json({ error: "inviteCode is required" });
            return;
        }

        const { data: group, error } = await supabaseAdmin
            .from("leaderboard_groups")
            .select(GROUP_FIELDS)
            .eq("invite_code", inviteCode)
            .maybeSingle();

        if (error) throw error;
        if (!group) {
            res.status(404).json({ error: "Invite code not found" });
            return;
        }

        await ensureGroupMember(group.id, req.user.id);
        const memberCount = await groupMemberCount(group.id);
        res.json({ group: publicGroup(group, memberCount) });
    } catch (error) {
        next(error);
    }
});

app.post("/api/groups/defaults/sync", requireSupabase, requireUser, async (req, res, next) => {
    try {
        const safeScrollingWorst = validateStringArray(req.body?.scrollingWorst, "scrollingWorst");
        if (safeScrollingWorst.error) {
            res.status(400).json({ error: safeScrollingWorst.error });
            return;
        }

        const selectedLabels = [...new Set(safeScrollingWorst)];
        const unknownLabels = selectedLabels.filter((label) => !DEFAULT_GROUP_LABELS.has(label));
        if (unknownLabels.length > 0) {
            res.status(400).json({ error: "scrollingWorst contains unknown options" });
            return;
        }

        const groups = await syncDefaultGroupMemberships(req.user.id, selectedLabels);
        res.json({ groups });
    } catch (error) {
        next(error);
    }
});

app.get("/api/groups/:groupId/leaderboard", requireSupabase, requireUser, async (req, res, next) => {
    try {
        const { groupId } = req.params;
        await assertGroupMember(groupId, req.user.id);

        const { data: members, error: membersError } = await supabaseAdmin
            .from("group_members")
            .select("user_id")
            .eq("group_id", groupId);

        if (membersError) throw membersError;

        const memberIds = [...new Set((members || []).map((member) => member.user_id).filter(Boolean))];
        if (!memberIds.length) {
            res.json({ leaderboard: [] });
            return;
        }

        const { data: sessions, error: sessionsError } = await supabaseAdmin
            .from("block_sessions")
            .select("user_id,total_duration_seconds,started_at,ended_at")
            .in("user_id", memberIds)
            .not("ended_at", "is", null);

        if (sessionsError) throw sessionsError;

        const totals = new Map(memberIds.map((userId) => [userId, 0]));
        for (const session of sessions || []) {
            totals.set(session.user_id, (totals.get(session.user_id) || 0) + lockedSecondsForSession(session));
        }

        const names = new Map(await Promise.all(memberIds.map(async (userId) => [
            userId,
            await displayNameForUser(userId)
        ])));

        const leaderboard = memberIds
            .map((userId) => ({
                userId,
                displayName: names.get(userId) || "User",
                lockedSeconds: totals.get(userId) || 0,
                isCurrentUser: userId === req.user.id
            }))
            .sort((left, right) => right.lockedSeconds - left.lockedSeconds || left.displayName.localeCompare(right.displayName))
            .map((entry, index) => ({
                rank: index + 1,
                ...entry
            }));

        res.json({ leaderboard });
    } catch (error) {
        next(error);
    }
});

app.get("/api/session/current", requireSupabase, requireUser, async (req, res, next) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("block_sessions")
            .select(SESSION_FIELDS)
            .eq("user_id", req.user.id)
            .is("ended_at", null)
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        if (data && isExpired(data)) {
            const { error: closeExpiredError } = await closeSession(req.user.id, data.id);
            if (closeExpiredError) throw closeExpiredError;
            res.json({ session: null });
            return;
        }

        res.json({ session: data });
    } catch (error) {
        next(error);
    }
});

app.put("/api/session/current", requireSupabase, requireUser, async (req, res, next) => {
    try {
        const {
            active,
            appsBlocked,
            domainsBlocked,
            targets,
            totalDurationSeconds,
            sessionId
        } = req.body || {};

        if (active === true) {
            const safeAppsBlocked = validateStringArray(appsBlocked, "appsBlocked");
            if (safeAppsBlocked.error) {
                res.status(400).json({ error: safeAppsBlocked.error });
                return;
            }

            const safeDomainsBlocked = validateStringArray(domainsBlocked, "domainsBlocked");
            if (safeDomainsBlocked.error) {
                res.status(400).json({ error: safeDomainsBlocked.error });
                return;
            }

            const safeTargets = validateStringArray(targets, "targets");
            if (safeTargets.error) {
                res.status(400).json({ error: safeTargets.error });
                return;
            }

            if (!Number.isInteger(totalDurationSeconds) || totalDurationSeconds <= 0) {
                res.status(400).json({ error: "totalDurationSeconds must be a positive integer" });
                return;
            }

            const expandedTargets = expandBlockTargets({
                appsBlocked: safeAppsBlocked,
                domainsBlocked: safeDomainsBlocked,
                targets: safeTargets
            });

            if (
                expandedTargets.appsBlocked.length === 0
                && expandedTargets.domainsBlocked.length === 0
                && expandedTargets.processTokens.length === 0
            ) {
                res.status(400).json({ error: "At least one target is required" });
                return;
            }

            const { error: closeExistingError } = await closeSession(req.user.id);

            if (closeExistingError) throw closeExistingError;

            let { data, error } = await createSession(req.user.id, expandedTargets, totalDurationSeconds);
            if (error && error.code === "23505") {
                const { error: retryCloseError } = await closeSession(req.user.id);
                if (retryCloseError) throw retryCloseError;
                ({ data, error } = await createSession(req.user.id, expandedTargets, totalDurationSeconds));
            }

            if (error) throw error;

            res.status(201).json({ session: data });
            return;
        }

        if (active === false) {
            const { data, error } = await closeSession(req.user.id, sessionId);

            if (error) throw error;

            res.json({ sessions: data });
            return;
        }

        res.status(400).json({ error: "active must be true or false" });
    } catch (error) {
        next(error);
    }
});

app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
});

app.use((err, _req, res, _next) => {
    console.error(err);
    const schemaError = missingSchemaError(err);
    if (schemaError) {
        res.status(schemaError.status).json({ error: schemaError.message });
        return;
    }
    const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600
        ? err.status
        : 500;
    res.status(status).json({ error: status === 500 ? "Internal server error" : err.message });
});

module.exports = app;
