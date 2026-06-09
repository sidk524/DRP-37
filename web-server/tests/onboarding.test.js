const request = require("supertest");

const makeQuery = (terminalMethod, terminalResult) => {
    const query = {};
    ["eq", "select", "single", "upsert", "maybeSingle"].forEach((method) => {
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

describe("onboarding API", () => {
    afterEach(() => {
        jest.dontMock("@supabase/supabase-js");
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_PUBLISHABLE_KEY;
        delete process.env.SUPABASE_SECRET_KEY;
    });

    it("returns null when the user has no onboarding row", async () => {
        const loadQuery = makeQuery("maybeSingle", { data: null, error: null });
        const { app } = loadApp({ adminQueries: [loadQuery] });

        const response = await request(app)
            .get("/api/onboarding")
            .set("Authorization", "Bearer token");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ onboarding: null });
    });

    it("returns camelCase onboarding settings", async () => {
        const loadQuery = makeQuery("maybeSingle", {
            data: {
                do_more_of: ["Reading"],
                scrolling_worst: ["Meals"],
                future_message: "Stay focused",
                strictness: "hard"
            },
            error: null
        });
        const { app } = loadApp({ adminQueries: [loadQuery] });

        const response = await request(app)
            .get("/api/onboarding")
            .set("Authorization", "Bearer token");

        expect(response.status).toBe(200);
        expect(response.body.onboarding).toEqual({
            doMoreOf: ["Reading"],
            scrollingWorst: ["Meals"],
            futureMessage: "Stay focused",
            strictness: "hard"
        });
    });

    it("upserts onboarding settings", async () => {
        const upsertQuery = makeQuery("single", {
            data: {
                do_more_of: ["Exercise"],
                scrolling_worst: ["Late night"],
                future_message: "Hello future me",
                strictness: "moderate"
            },
            error: null
        });
        const { app } = loadApp({ adminQueries: [upsertQuery] });

        const response = await request(app)
            .put("/api/onboarding")
            .set("Authorization", "Bearer token")
            .send({
                doMoreOf: ["Exercise"],
                scrollingWorst: ["Late night"],
                futureMessage: "Hello future me",
                strictness: "moderate"
            });

        expect(response.status).toBe(200);
        expect(response.body.onboarding.strictness).toBe("moderate");
        expect(upsertQuery.upsert).toHaveBeenCalledWith(
            {
                user_id: "user-1",
                do_more_of: ["Exercise"],
                scrolling_worst: ["Late night"],
                future_message: "Hello future me",
                strictness: "moderate"
            },
            { onConflict: "user_id" }
        );
    });
});
