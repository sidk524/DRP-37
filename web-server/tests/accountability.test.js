const request = require("supertest");

const makeQuery = (result) => {
    const query = { then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) };
    ["eq", "select", "upsert"].forEach((method) => {
        query[method] = jest.fn(() => query);
    });
    ["maybeSingle", "single"].forEach((method) => {
        query[method] = jest.fn(async () => result);
    });
    return query;
};

const loadApp = (queries) => {
    jest.resetModules();
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    process.env.SUPABASE_SECRET_KEY = "secret-key";
    const from = jest.fn(() => queries.shift());
    jest.doMock("@supabase/supabase-js", () => ({
        createClient: jest.fn()
            .mockReturnValueOnce({ auth: { getUser: jest.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })) } })
            .mockReturnValueOnce({ from, auth: { admin: {} } })
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
