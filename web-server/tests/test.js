const request = require("supertest");

const app = require("../src/app");

const get = (path) => {
    return request(app)
        .get(path)
        .timeout({
            response: 1000,
            deadline: 2000
        });
};

describe("DRP-37 web server", () => {
    describe("GET /", () => {
        it("returns basic server status", async () => {
            const response = await get("/");

            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toMatch(/application\/json/);
            expect(response.body).toEqual({
                name: "DRP-37 web server",
                status: "ok"
            });
        });
    });

    describe("GET /health", () => {
        it("returns the health check response", async () => {
            const response = await get("/health");

            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toMatch(/text\/plain/);
            expect(response.text).toBe("VERY HEALTHY");
        });
    });

    describe("unknown routes", () => {
        it("returns a 404 JSON response", async () => {
            const response = await get("/does-not-exist");

            expect(response.status).toBe(404);
            expect(response.headers["content-type"]).toMatch(/application\/json/);
            expect(response.body).toEqual({
                error: "Not found"
            });
        });
    });

    describe("security headers", () => {
        it("does not expose the X-Powered-By header", async () => {
            const response = await get("/");

            expect(response.headers["x-powered-by"]).toBeUndefined();
        });

        it("sets Helmet security headers", async () => {
            const response = await get("/");

            expect(response.headers["x-content-type-options"]).toBe("nosniff");
        });
    });
});