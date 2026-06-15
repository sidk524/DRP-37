const request = require("supertest");

const SESSION_FIELDS = "id,user_id,block_group_id,canonical_targets,apps_blocked,domains_blocked,process_tokens,total_duration_seconds,started_at,ended_at,mode,updated_at";

const makeQuery = (terminalMethod, terminalResult) => {
    const query = {};
    [
        "eq",
        "insert",
        "is",
        "limit",
        "maybeSingle",
        "order",
        "select",
        "single",
        "update",
        "upsert"
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
            block_group_id: null,
            canonical_targets: [],
            apps_blocked: ["com.example.app"],
            domains_blocked: [],
            process_tokens: [],
            total_duration_seconds: 60,
            started_at: "2026-06-03T12:00:00.000Z",
            mode: "reflect"
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
        // Lazy expiry now awards points once: upsert + select-back.
        const awardUpsertQuery = makeQuery("upsert", { error: null });
        const awardSelectQuery = makeQuery("maybeSingle", {
            data: {
                id: "points-1",
                user_id: "user-1",
                mode: "reflect",
                actual_ms: 60000,
                planned_ms: 60000,
                blocked_apps_count: 1,
                points: 2,
                ended_at: "2026-06-03T12:00:00.000Z",
                created_at: "2026-06-03T12:00:00.000Z"
            },
            error: null
        });
        const { app } = loadApp({ adminQueries: [loadQuery, closeQuery, awardUpsertQuery, awardSelectQuery] });

        const response = await request(app)
            .get("/api/session/current")
            .set("Authorization", "Bearer token");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ session: null });
        expect(closeQuery.update).toHaveBeenCalledWith({ ended_at: "2026-06-03T12:00:00.000Z" });
        expect(closeQuery.eq).toHaveBeenCalledWith("id", "session-1");
        expect(awardUpsertQuery.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ block_session_id: "session-1", user_id: "user-1" }),
            { onConflict: "block_session_id", ignoreDuplicates: true }
        );
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
            block_group_id: null,
            canonical_targets: ["instagram"],
            apps_blocked: ["com.instagram.android"],
            domains_blocked: ["instagram.com", "www.instagram.com"],
            process_tokens: ["instagram"],
            total_duration_seconds: 60,
            started_at: expect.any(String),
            mode: "reflect"
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

    it("patches the mode of the active session", async () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-06-03T12:00:00.000Z"));
        const updatedSession = {
            id: "session-1",
            user_id: "user-1",
            block_group_id: null,
            canonical_targets: [],
            apps_blocked: ["com.example.app"],
            domains_blocked: [],
            process_tokens: [],
            total_duration_seconds: 60,
            started_at: "2026-06-03T11:59:00.000Z",
            ended_at: null,
            mode: "hard",
            updated_at: "2026-06-03T12:00:00.000Z"
        };
        const updateQuery = makeQuery("maybeSingle", { data: updatedSession, error: null });
        const { app } = loadApp({ adminQueries: [updateQuery] });

        const response = await request(app)
            .patch("/api/session/current")
            .set("Authorization", "Bearer token")
            .send({ mode: "hard" });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ session: updatedSession });
        expect(updateQuery.update).toHaveBeenCalledWith({
            mode: "hard",
            updated_at: "2026-06-03T12:00:00.000Z"
        });
        expect(updateQuery.is).toHaveBeenCalledWith("ended_at", null);
    });

    it("rejects an invalid mode", async () => {
        const { app } = loadApp({ adminQueries: [] });

        const response = await request(app)
            .patch("/api/session/current")
            .set("Authorization", "Bearer token")
            .send({ mode: "nope" });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/mode must be one of/);
    });

    it("returns 404 when patching with no active session", async () => {
        const updateQuery = makeQuery("maybeSingle", { data: null, error: null });
        const { app } = loadApp({ adminQueries: [updateQuery] });

        const response = await request(app)
            .patch("/api/session/current")
            .set("Authorization", "Bearer token")
            .send({ mode: "breathing" });

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: "No active session" });
    });

    it("awards points once when a session is closed by expiry, from the session row", async () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-06-03T12:00:00.000Z"));
        const closedRow = {
            id: "session-1",
            user_id: "user-1",
            block_group_id: null,
            canonical_targets: ["instagram", "tiktok"],
            apps_blocked: ["com.instagram.android"],
            domains_blocked: ["instagram.com"],
            process_tokens: [],
            total_duration_seconds: 60,
            started_at: "2026-06-03T11:59:00.000Z",
            ended_at: "2026-06-03T12:00:00.000Z",
            mode: "hard",
            updated_at: "2026-06-03T12:00:00.000Z"
        };
        const awardedRecord = {
            id: "points-1",
            user_id: "user-1",
            mode: "hard",
            actual_ms: 60000,
            planned_ms: 60000,
            blocked_apps_count: 2,
            points: 3,
            ended_at: "2026-06-03T12:00:00.000Z",
            created_at: "2026-06-03T12:00:00.000Z"
        };
        const closeQuery = makeQuery("select", { data: [closedRow], error: null });
        const awardUpsertQuery = makeQuery("upsert", { error: null });
        const awardSelectQuery = makeQuery("maybeSingle", { data: awardedRecord, error: null });
        const { app } = loadApp({ adminQueries: [closeQuery, awardUpsertQuery, awardSelectQuery] });

        const response = await authorized(app).send({
            active: false,
            reason: "expired",
            sessionId: "session-1"
        });

        expect(response.status).toBe(200);
        expect(response.body.completed).toEqual(awardedRecord);
        // blocked count + mode come from the session row (2 canonical targets), not the request.
        expect(awardUpsertQuery.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                block_session_id: "session-1",
                mode: "hard",
                blocked_apps_count: 2,
                points: 3
            }),
            { onConflict: "block_session_id", ignoreDuplicates: true }
        );
    });

    it("does not award points on a manual stop", async () => {
        const closeQuery = makeQuery("select", { data: [], error: null });
        const { app } = loadApp({ adminQueries: [closeQuery] });

        const response = await authorized(app).send({
            active: false,
            reason: "manual",
            sessionId: "session-1"
        });

        expect(response.status).toBe(200);
        expect(response.body.completed).toBeNull();
    });
});
