const request = require("supertest");

const BLOCK_GROUP_FIELDS = "id,user_id,name,system_key,targets,apps_blocked,domains_blocked,canonical_targets,expanded_apps_blocked,expanded_domains_blocked,process_tokens,created_at,updated_at";

const makeQuery = (terminalMethod, terminalResult) => {
    const query = {};
    [
        "delete",
        "eq",
        "insert",
        "is",
        "limit",
        "maybeSingle",
        "order",
        "select",
        "single",
        "update"
    ].forEach((method) => {
        query[method] = jest.fn(() => query);
    });
    if (terminalMethod === "then") {
        query.then = (resolve, reject) => Promise.resolve(terminalResult).then(resolve, reject);
    } else {
        query[terminalMethod] = jest.fn(async () => terminalResult);
    }
    return query;
};

const loadApp = ({ authResult, adminQueries }) => {
    jest.resetModules();
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    process.env.SUPABASE_SECRET_KEY = "secret-key";

    const getUser = jest.fn(async () => authResult || {
        data: { user: { id: "user-1" } },
        error: null
    });
    const from = jest.fn(() => {
        const query = adminQueries.shift();
        if (!query) throw new Error("Unexpected Supabase query");
        return query;
    });

    jest.doMock("@supabase/supabase-js", () => ({
        createClient: jest.fn()
            .mockReturnValueOnce({ auth: { getUser } })
            .mockReturnValueOnce({ from })
    }));

    return {
        app: require("../src/app"),
        from,
        getUser
    };
};

const groupRow = (overrides = {}) => ({
    id: "group-1",
    user_id: "user-1",
    name: "My group",
    system_key: null,
    targets: ["instagram"],
    apps_blocked: [],
    domains_blocked: [],
    canonical_targets: ["instagram"],
    expanded_apps_blocked: ["com.instagram.android"],
    expanded_domains_blocked: ["instagram.com", "www.instagram.com"],
    process_tokens: ["instagram"],
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides
});

const publicGroup = (row) => ({
    id: row.id,
    name: row.name,
    systemKey: row.system_key,
    targets: row.targets,
    appsBlocked: row.apps_blocked,
    domainsBlocked: row.domains_blocked,
    canonicalTargets: row.canonical_targets,
    expandedAppsBlocked: row.expanded_apps_blocked,
    expandedDomainsBlocked: row.expanded_domains_blocked,
    processTokens: row.process_tokens,
    createdAt: row.created_at,
    updatedAt: row.updated_at
});

describe("block groups API", () => {
    afterEach(() => {
        jest.dontMock("@supabase/supabase-js");
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_PUBLISHABLE_KEY;
        delete process.env.SUPABASE_SECRET_KEY;
    });

    it("seeds the three default groups for a new user", async () => {
        const emptyListQuery = makeQuery("eq", { data: [], error: null });
        const insertQuery = makeQuery("select", { data: [{ id: "g1" }, { id: "g2" }, { id: "g3" }], error: null });
        const seededRows = [
            groupRow({ id: "g1", name: "Social media", system_key: "social_media" }),
            groupRow({ id: "g2", name: "Messaging", system_key: "messaging" }),
            groupRow({ id: "g3", name: "Streaming", system_key: "streaming" })
        ];
        const finalListQuery = makeQuery("eq", { data: seededRows, error: null });
        const { app } = loadApp({ adminQueries: [emptyListQuery, insertQuery, finalListQuery] });

        const response = await request(app)
            .get("/api/block-groups")
            .set("Authorization", "Bearer token");

        expect(response.status).toBe(200);
        expect(response.body.blockGroups).toHaveLength(3);
        expect(response.body.blockGroups.map((group) => group.systemKey))
            .toEqual(["social_media", "messaging", "streaming"]);

        const insertedRows = insertQuery.insert.mock.calls[0][0];
        expect(insertedRows).toHaveLength(3);
        const socialMedia = insertedRows.find((row) => row.system_key === "social_media");
        expect(socialMedia.name).toBe("Social media");
        expect(socialMedia.expanded_apps_blocked).toContain("com.instagram.android");
        expect(socialMedia.expanded_domains_blocked).toContain("tiktok.com");
        const messaging = insertedRows.find((row) => row.system_key === "messaging");
        expect(messaging.expanded_apps_blocked).toContain("com.whatsapp");
        expect(messaging.expanded_domains_blocked).toContain("web.whatsapp.com");
        const streaming = insertedRows.find((row) => row.system_key === "streaming");
        expect(streaming.expanded_domains_blocked).toContain("netflix.com");
        expect(streaming.expanded_domains_blocked).toContain("primevideo.com");
    });

    it("does not reseed when defaults already exist", async () => {
        const seededRows = [
            groupRow({ id: "g1", name: "Social media", system_key: "social_media" }),
            groupRow({ id: "g2", name: "Messaging", system_key: "messaging" }),
            groupRow({ id: "g3", name: "Streaming", system_key: "streaming" }),
            groupRow({ id: "g4", name: "Custom", system_key: null })
        ];
        const listQuery = makeQuery("eq", { data: seededRows, error: null });
        const { app, from } = loadApp({ adminQueries: [listQuery] });

        const response = await request(app)
            .get("/api/block-groups")
            .set("Authorization", "Bearer token");

        expect(response.status).toBe(200);
        expect(from).toHaveBeenCalledTimes(1);
        expect(response.body.blockGroups.map((group) => group.name))
            .toEqual(["Social media", "Messaging", "Streaming", "Custom"]);
    });

    it("creates a custom group with expanded targets", async () => {
        const createdRow = groupRow({ name: "Focus" });
        const insertQuery = makeQuery("single", { data: createdRow, error: null });
        const { app } = loadApp({ adminQueries: [insertQuery] });

        const response = await request(app)
            .post("/api/block-groups")
            .set("Authorization", "Bearer token")
            .send({ name: "Focus", domainsBlocked: ["instagram.com"] });

        expect(response.status).toBe(201);
        expect(response.body).toEqual({ blockGroup: publicGroup(createdRow) });
        expect(insertQuery.insert).toHaveBeenCalledWith({
            user_id: "user-1",
            name: "Focus",
            system_key: null,
            targets: [],
            apps_blocked: [],
            domains_blocked: ["instagram.com"],
            canonical_targets: ["instagram"],
            expanded_apps_blocked: ["com.instagram.android"],
            expanded_domains_blocked: ["instagram.com", "www.instagram.com"],
            process_tokens: ["instagram"]
        });
        expect(insertQuery.select).toHaveBeenCalledWith(BLOCK_GROUP_FIELDS);
    });

    it("rejects creating a group with no blockable content", async () => {
        const { app } = loadApp({ adminQueries: [] });

        const response = await request(app)
            .post("/api/block-groups")
            .set("Authorization", "Bearer token")
            .send({ name: "Empty" });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "At least one app or website is required" });
    });

    it("rejects creating a group without a name", async () => {
        const { app } = loadApp({ adminQueries: [] });

        const response = await request(app)
            .post("/api/block-groups")
            .set("Authorization", "Bearer token")
            .send({ domainsBlocked: ["instagram.com"] });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "name is required" });
    });

    it("updates a group and re-expands targets", async () => {
        const existingRow = groupRow();
        const loadQuery = makeQuery("maybeSingle", { data: existingRow, error: null });
        const updatedRow = groupRow({
            name: "Renamed",
            targets: ["tiktok"],
            canonical_targets: ["tiktok"],
            expanded_apps_blocked: ["com.ss.android.ugc.trill", "com.zhiliaoapp.musically"],
            expanded_domains_blocked: ["tiktok.com", "www.tiktok.com"],
            process_tokens: ["tiktok"]
        });
        const updateQuery = makeQuery("single", { data: updatedRow, error: null });
        const { app } = loadApp({ adminQueries: [loadQuery, updateQuery] });

        const response = await request(app)
            .put("/api/block-groups/group-1")
            .set("Authorization", "Bearer token")
            .send({ name: "Renamed", targets: ["tiktok"], appsBlocked: [], domainsBlocked: [] });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ blockGroup: publicGroup(updatedRow) });
        expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
            name: "Renamed",
            targets: ["tiktok"],
            canonical_targets: ["tiktok"],
            expanded_apps_blocked: ["com.ss.android.ugc.trill", "com.zhiliaoapp.musically"],
            expanded_domains_blocked: ["tiktok.com", "www.tiktok.com"],
            process_tokens: ["tiktok"]
        }));
    });

    it("returns 404 when updating a group the user does not own", async () => {
        const loadQuery = makeQuery("maybeSingle", { data: null, error: null });
        const { app } = loadApp({ adminQueries: [loadQuery] });

        const response = await request(app)
            .put("/api/block-groups/group-9")
            .set("Authorization", "Bearer token")
            .send({ name: "Hijack" });

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: "Block group not found" });
    });

    it("deletes a custom group", async () => {
        const loadQuery = makeQuery("maybeSingle", { data: groupRow(), error: null });
        const deleteQuery = makeQuery("then", { error: null });
        const { app } = loadApp({ adminQueries: [loadQuery, deleteQuery] });

        const response = await request(app)
            .delete("/api/block-groups/group-1")
            .set("Authorization", "Bearer token");

        expect(response.status).toBe(204);
        expect(deleteQuery.delete).toHaveBeenCalled();
    });

    it("refuses to delete a system default group", async () => {
        const loadQuery = makeQuery("maybeSingle", {
            data: groupRow({ system_key: "social_media" }),
            error: null
        });
        const { app } = loadApp({ adminQueries: [loadQuery] });

        const response = await request(app)
            .delete("/api/block-groups/group-1")
            .set("Authorization", "Bearer token");

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ error: "Default block groups cannot be deleted" });
    });

    it("returns 503 when the block_groups table is missing", async () => {
        const listQuery = makeQuery("eq", {
            data: null,
            error: { code: "PGRST205", message: "Could not find the table 'public.block_groups'" }
        });
        const { app } = loadApp({ adminQueries: [listQuery] });

        const response = await request(app)
            .get("/api/block-groups")
            .set("Authorization", "Bearer token");

        expect(response.status).toBe(503);
        expect(response.body.error).toMatch(/006_block_groups/);
    });

    it("requires authentication", async () => {
        const { app } = loadApp({ adminQueries: [] });

        const response = await request(app).get("/api/block-groups");

        expect(response.status).toBe(401);
    });
});

describe("session start with blockGroupId", () => {
    afterEach(() => {
        jest.dontMock("@supabase/supabase-js");
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_PUBLISHABLE_KEY;
        delete process.env.SUPABASE_SECRET_KEY;
    });

    it("starts a session from a block group", async () => {
        const group = groupRow();
        const loadGroupQuery = makeQuery("maybeSingle", { data: group, error: null });
        const closeQuery = makeQuery("select", { data: [], error: null });
        const createdSession = {
            id: "session-1",
            user_id: "user-1",
            block_group_id: "group-1",
            canonical_targets: group.canonical_targets,
            apps_blocked: group.expanded_apps_blocked,
            domains_blocked: group.expanded_domains_blocked,
            process_tokens: group.process_tokens,
            total_duration_seconds: 600,
            started_at: "2026-06-03T12:00:00.000Z",
            ended_at: null
        };
        const insertQuery = makeQuery("single", { data: createdSession, error: null });
        const { app } = loadApp({ adminQueries: [loadGroupQuery, closeQuery, insertQuery] });

        const response = await request(app)
            .put("/api/session/current")
            .set("Authorization", "Bearer token")
            .send({ active: true, blockGroupId: "group-1", totalDurationSeconds: 600 });

        expect(response.status).toBe(201);
        expect(response.body).toEqual({ session: createdSession });
        expect(insertQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
            user_id: "user-1",
            block_group_id: "group-1",
            canonical_targets: group.canonical_targets,
            apps_blocked: group.expanded_apps_blocked,
            domains_blocked: group.expanded_domains_blocked,
            process_tokens: group.process_tokens,
            total_duration_seconds: 600
        }));
    });

    it("returns 404 for an unknown block group", async () => {
        const loadGroupQuery = makeQuery("maybeSingle", { data: null, error: null });
        const { app } = loadApp({ adminQueries: [loadGroupQuery] });

        const response = await request(app)
            .put("/api/session/current")
            .set("Authorization", "Bearer token")
            .send({ active: true, blockGroupId: "group-9", totalDurationSeconds: 600 });

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: "Block group not found" });
    });

    it("rejects a non-positive duration before loading the group", async () => {
        const { app, from } = loadApp({ adminQueries: [] });

        const response = await request(app)
            .put("/api/session/current")
            .set("Authorization", "Bearer token")
            .send({ active: true, blockGroupId: "group-1", totalDurationSeconds: 0 });

        expect(response.status).toBe(400);
        expect(from).not.toHaveBeenCalled();
    });
});
