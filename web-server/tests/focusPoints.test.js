const request = require("supertest");

const makeQuery = (terminalMethod, terminalResult) => {
    const query = {};
    ["eq", "select", "single", "insert"].forEach((method) => {
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

    return { app: require("../src/app"), from, getUser };
};

describe("focus points API", () => {
    afterEach(() => {
        jest.dontMock("@supabase/supabase-js");
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_PUBLISHABLE_KEY;
        delete process.env.SUPABASE_SECRET_KEY;
    });

    it("records focus points for an expired session", async () => {
        const insertQuery = makeQuery("single", {
            data: {
                id: "point-1",
                user_id: "user-1",
                mode: "reflect",
                actual_ms: 1800000,
                planned_ms: 1800000,
                blocked_apps_count: 2,
                points: 34,
                ended_at: "2026-06-08T12:00:00.000Z",
                created_at: "2026-06-08T12:00:00.000Z",
            },
            error: null,
        });
        const { app } = loadApp({ adminQueries: [insertQuery] });

        const response = await request(app)
            .post("/api/focus-points")
            .set("Authorization", "Bearer token")
            .send({
                mode: "reflect",
                actualMs: 1800000,
                plannedMs: 1800000,
                blockedAppsCount: 2,
                endedAt: "2026-06-08T12:00:00.000Z",
            });

        expect(response.status).toBe(201);
        expect(response.body.record).toMatchObject({
            mode: "reflect",
            actual_ms: 1800000,
            blocked_apps_count: 2,
            points: 34,
        });
    });

    it("returns the user's total focus points", async () => {
        const selectQuery = makeQuery("eq", {
            data: [{ points: 10 }, { points: 24 }],
            error: null,
        });
        const { app } = loadApp({ adminQueries: [selectQuery] });

        const response = await request(app)
            .get("/api/focus-points/total")
            .set("Authorization", "Bearer token");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ total: 34 });
    });
});
