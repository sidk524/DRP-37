const request = require("supertest");

const SESSION_FIELDS = "id,user_id,canonical_targets,apps_blocked,domains_blocked,process_tokens,total_duration_seconds,started_at,ended_at";

const makeQuery = (terminalMethod, terminalResult) => {
    const query = {};
    [
        "eq",
        "insert",
        "is",
        "limit",
        "order",
        "select",
        "single",
        "update"
    ].forEach((method) => {
        query[method] = jest.fn(() => query);
    });
    query[terminalMethod] = jest.fn(async () => terminalResult);
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

const authorized = (app) => request(app)
    .put("/api/session/current")
    .set("Authorization", "Bearer token");

describe("block session API", () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.dontMock("@supabase/supabase-js");
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_PUBLISHABLE_KEY;
        delete process.env.SUPABASE_SECRET_KEY;
    });

    it("records a new session using the server timestamp", async () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-06-03T12:00:00.000Z"));
        const closeQuery = makeQuery("select", { data: [], error: null });
        const createdSession = {
            id: "session-1",
            user_id: "user-1",
            canonical_targets: [],
            apps_blocked: ["com.example.app"],
            domains_blocked: [],
            process_tokens: [],
            total_duration_seconds: 60,
            started_at: "2026-06-03T12:00:00.000Z",
            ended_at: null
        };
        const insertQuery = makeQuery("single", { data: createdSession, error: null });
        const { app } = loadApp({ adminQueries: [closeQuery, insertQuery] });

        const response = await authorized(app).send({
            active: true,
            appsBlocked: ["com.example.app"],
            totalDurationSeconds: 60,
            startedAt: "2099-01-01T00:00:00.000Z"
        });

        expect(response.status).toBe(201);
        expect(response.body).toEqual({ session: createdSession });
        expect(insertQuery.insert).toHaveBeenCalledWith({
            user_id: "user-1",
            canonical_targets: [],
            apps_blocked: ["com.example.app"],
            domains_blocked: [],
            process_tokens: [],
            total_duration_seconds: 60,
            started_at: "2026-06-03T12:00:00.000Z"
        });
    });

    it("closes expired current sessions and returns no active session", async () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-06-03T12:00:00.000Z"));
        const expiredSession = {
            id: "session-1",
            user_id: "user-1",
            canonical_targets: [],
            apps_blocked: ["com.example.app"],
            domains_blocked: [],
            process_tokens: [],
            total_duration_seconds: 60,
            started_at: "2026-06-03T11:58:00.000Z",
            ended_at: null
        };
        const loadQuery = makeQuery("maybeSingle", { data: expiredSession, error: null });
        const closeQuery = makeQuery("select", { data: [{ ...expiredSession, ended_at: "2026-06-03T12:00:00.000Z" }], error: null });
        const { app } = loadApp({ adminQueries: [loadQuery, closeQuery] });

        const response = await request(app)
            .get("/api/session/current")
            .set("Authorization", "Bearer token");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ session: null });
        expect(closeQuery.update).toHaveBeenCalledWith({ ended_at: "2026-06-03T12:00:00.000Z" });
        expect(closeQuery.eq).toHaveBeenCalledWith("id", "session-1");
    });

    it("rejects invalid app package arrays before inserting", async () => {
        const { app } = loadApp({ adminQueries: [] });

        const response = await authorized(app).send({
            active: true,
            appsBlocked: ["com.example.app", ""],
            totalDurationSeconds: 60
        });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "appsBlocked must contain non-empty strings" });
    });

    it("records expanded cross-platform targets", async () => {
        const closeQuery = makeQuery("select", { data: [], error: null });
        const createdSession = {
            id: "session-1",
            user_id: "user-1",
            canonical_targets: ["instagram"],
            apps_blocked: ["com.instagram.android"],
            domains_blocked: ["instagram.com", "www.instagram.com"],
            process_tokens: ["instagram"],
            total_duration_seconds: 60,
            started_at: "2026-06-03T12:00:00.000Z",
            ended_at: null
        };
        const insertQuery = makeQuery("single", { data: createdSession, error: null });
        const { app } = loadApp({ adminQueries: [closeQuery, insertQuery] });

        const response = await authorized(app).send({
            active: true,
            domainsBlocked: ["instagram.com"],
            totalDurationSeconds: 60
        });

        expect(response.status).toBe(201);
        expect(response.body).toEqual({ session: createdSession });
        expect(insertQuery.insert).toHaveBeenCalledWith({
            user_id: "user-1",
            canonical_targets: ["instagram"],
            apps_blocked: ["com.instagram.android"],
            domains_blocked: ["instagram.com", "www.instagram.com"],
            process_tokens: ["instagram"],
            total_duration_seconds: 60,
            started_at: expect.any(String)
        });
    });

    it("selects the expected session fields", async () => {
        const closeQuery = makeQuery("select", { data: [], error: null });
        const insertQuery = makeQuery("single", {
            data: {
                id: "session-1",
                user_id: "user-1",
                canonical_targets: [],
                apps_blocked: [],
                domains_blocked: ["example.com"],
                process_tokens: [],
                total_duration_seconds: 5,
                started_at: "2026-06-03T12:00:00.000Z",
                ended_at: null
            },
            error: null
        });
        const { app } = loadApp({ adminQueries: [closeQuery, insertQuery] });

        await authorized(app).send({
            active: true,
            domainsBlocked: ["example.com"],
            totalDurationSeconds: 5
        });

        expect(closeQuery.select).toHaveBeenCalledWith(SESSION_FIELDS);
        expect(insertQuery.select).toHaveBeenCalledWith(SESSION_FIELDS);
    });
});
