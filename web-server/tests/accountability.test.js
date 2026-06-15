const request = require("supertest");

const makeQuery = (result) => {
    const query = { then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) };
    [
        "eq",
        "in",
        "is",
        "insert",
        "select",
        "update",
        "upsert"
    ].forEach((method) => {
        query[method] = jest.fn(() => query);
    });
    ["maybeSingle", "single"].forEach((method) => {
        query[method] = jest.fn(async () => result);
    });
    return query;
};

const loadApp = (queries, userId = "user-1") => {
    jest.resetModules();
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    process.env.SUPABASE_SECRET_KEY = "secret-key";
    const from = jest.fn(() => {
        const query = queries.shift();
        if (!query) throw new Error("Unexpected Supabase query");
        return query;
    });
    const getUserById = jest.fn(async (id) => ({
        data: { user: { id, email: `${id}@example.com`, user_metadata: { display_name: `User ${id}` } } },
        error: null
    }));
    jest.doMock("@supabase/supabase-js", () => ({
        createClient: jest.fn()
            .mockReturnValueOnce({
                auth: {
                    getUser: jest.fn(async () => ({ data: { user: { id: userId } }, error: null }))
                }
            })
            .mockReturnValueOnce({ from, auth: { admin: { getUserById } } })
    }));
    return require("../src/app");
};

const authorized = (app, method, path) => request(app)[method](path).set("Authorization", "Bearer token");

describe("accountability preferences", () => {
    afterEach(() => {
        jest.dontMock("@supabase/supabase-js");
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_PUBLISHABLE_KEY;
        delete process.env.SUPABASE_SECRET_KEY;
    });

    it("defaults both independent preferences to enabled", async () => {
        const app = loadApp([makeQuery({ data: null, error: null })]);
        const response = await authorized(app, "get", "/api/accountability/preferences");
        expect(response.status).toBe(200);
        expect(response.body.preferences).toEqual({
            shareActivity: true,
            receiveFriendAlerts: true
        });
    });

    it("persists independent preference values", async () => {
        const query = makeQuery({
            data: { share_activity: false, receive_friend_alerts: true },
            error: null
        });
        const app = loadApp([query]);
        const response = await authorized(app, "put", "/api/accountability/preferences").send({
            shareActivity: false,
            receiveFriendAlerts: true
        });
        expect(response.status).toBe(200);
        expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({
            user_id: "user-1",
            share_activity: false,
            receive_friend_alerts: true
        }), { onConflict: "user_id" });
    });

    it("rejects missing or non-boolean preference values", async () => {
        const app = loadApp([]);
        const response = await authorized(app, "put", "/api/accountability/preferences").send({
            shareActivity: false
        });
        expect(response.status).toBe(400);
    });
});

describe("accountability attempts", () => {
    afterEach(() => {
        jest.dontMock("@supabase/supabase-js");
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_PUBLISHABLE_KEY;
        delete process.env.SUPABASE_SECRET_KEY;
    });

    it("ignores attempts when sharing is disabled", async () => {
        const app = loadApp([
            makeQuery({ data: { share_activity: false, receive_friend_alerts: true }, error: null })
        ]);
        const response = await authorized(app, "post", "/api/accountability/attempts").send({
            targetType: "app",
            targetKey: "com.instagram.android",
            targetLabel: "Instagram",
            idempotencyKey: "key-1"
        });
        expect(response.status).toBe(202);
        expect(response.body).toEqual({ ignored: true, reason: "sharing_disabled" });
    });

    it("ignores attempts when user has no custom groups", async () => {
        const future = new Date(Date.now() + 3600_000).toISOString();
        const app = loadApp([
            makeQuery({ data: { share_activity: true, receive_friend_alerts: true }, error: null }),
            makeQuery({
                data: {
                    id: "session-1",
                    apps_blocked: ["com.instagram.android"],
                    domains_blocked: [],
                    mode: "reflect",
                    started_at: new Date().toISOString(),
                    total_duration_seconds: 3600
                },
                error: null
            }),
            makeQuery({ data: [{ group_id: "default-g1" }], error: null }),
            makeQuery({ data: [], error: null })
        ]);
        const response = await authorized(app, "post", "/api/accountability/attempts").send({
            targetType: "app",
            targetKey: "com.instagram.android",
            targetLabel: "Instagram",
            idempotencyKey: "key-2"
        });
        expect(response.status).toBe(202);
        expect(response.body).toEqual({ ignored: true, reason: "no_custom_groups" });
    });

    it("rejects attempts for targets not in the active session", async () => {
        const app = loadApp([
            makeQuery({ data: { share_activity: true, receive_friend_alerts: true }, error: null }),
            makeQuery({
                data: {
                    id: "session-1",
                    apps_blocked: ["com.twitter.android"],
                    domains_blocked: [],
                    mode: "reflect",
                    started_at: new Date().toISOString(),
                    total_duration_seconds: 3600
                },
                error: null
            })
        ]);
        const response = await authorized(app, "post", "/api/accountability/attempts").send({
            targetType: "app",
            targetKey: "com.instagram.android",
            targetLabel: "Instagram",
            idempotencyKey: "key-3"
        });
        expect(response.status).toBe(400);
    });
});

describe("accountability presence", () => {
    afterEach(() => {
        jest.dontMock("@supabase/supabase-js");
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_PUBLISHABLE_KEY;
        delete process.env.SUPABASE_SECRET_KEY;
    });

    it("rejects presence for default groups", async () => {
        const app = loadApp([
            makeQuery({ data: { id: "group-1", default_group_key: "late_night" }, error: null })
        ]);
        const response = await authorized(app, "get", "/api/groups/group-1/presence");
        expect(response.status).toBe(404);
    });
});

describe("accountability message read", () => {
    afterEach(() => {
        jest.dontMock("@supabase/supabase-js");
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_PUBLISHABLE_KEY;
        delete process.env.SUPABASE_SECRET_KEY;
    });

    it("marks a message as read", async () => {
        const updateQuery = makeQuery({ data: { id: "msg-1" }, error: null });
        const unreadNotifQuery = makeQuery({ data: [], error: null });
        const unreadMsgQuery = makeQuery({ data: [], error: null });
        const app = loadApp([updateQuery, unreadNotifQuery, unreadMsgQuery]);
        const response = await authorized(app, "post", "/api/accountability/messages/msg-1/read");
        expect(response.status).toBe(200);
        expect(response.body.unreadCount).toBe(0);
    });
});
