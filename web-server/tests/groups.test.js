const request = require("supertest");

const makeQuery = (result) => {
    const query = {
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
    };
    [
        "eq",
        "delete",
        "in",
        "insert",
        "limit",
        "not",
        "select"
    ].forEach((method) => {
        query[method] = jest.fn(() => query);
    });
    [
        "maybeSingle",
        "single"
    ].forEach((method) => {
        query[method] = jest.fn(async () => result);
    });
    return query;
};

const loadApp = ({ authResult, adminQueries, usersById = {} }) => {
    jest.resetModules();
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    process.env.SUPABASE_SECRET_KEY = "secret-key";

    const getUser = jest.fn(async () => authResult || {
        data: { user: { id: "user-1" } },
        error: null
    });
    const getUserById = jest.fn(async (userId) => ({
        data: { user: usersById[userId] || { id: userId, email: `${userId}@example.com` } },
        error: null
    }));
    const from = jest.fn(() => {
        const query = adminQueries.shift();
        if (!query) throw new Error("Unexpected Supabase query");
        return query;
    });

    jest.doMock("@supabase/supabase-js", () => ({
        createClient: jest.fn()
            .mockReturnValueOnce({ auth: { getUser } })
            .mockReturnValueOnce({ from, auth: { admin: { getUserById } } })
    }));

    return {
        app: require("../src/app"),
        from,
        getUser,
        getUserById
    };
};

const authorizedPost = (app, path) => request(app)
    .post(path)
    .set("Authorization", "Bearer token");

const authorizedGet = (app, path) => request(app)
    .get(path)
    .set("Authorization", "Bearer token");

describe("group leaderboard API", () => {
    afterEach(() => {
        jest.dontMock("@supabase/supabase-js");
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_PUBLISHABLE_KEY;
        delete process.env.SUPABASE_SECRET_KEY;
    });

    it("creates a group and adds the creator as a member", async () => {
        const group = {
            id: "group-1",
            name: "Study Squad",
            invite_code: "ABCDEFGH",
            created_by: "user-1",
            created_at: "2026-06-05T09:00:00.000Z"
        };
        const createQuery = makeQuery({ data: group, error: null });
        const memberQuery = makeQuery({ data: { id: "member-1" }, error: null });
        const { app } = loadApp({ adminQueries: [createQuery, memberQuery] });

        const response = await authorizedPost(app, "/api/groups")
            .send({ name: "  Study Squad  " });

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
            group: {
                id: "group-1",
                name: "Study Squad",
                inviteCode: "ABCDEFGH",
                createdBy: "user-1",
                createdAt: "2026-06-05T09:00:00.000Z",
                memberCount: 1
            }
        });
        expect(createQuery.insert).toHaveBeenCalledWith({
            name: "Study Squad",
            invite_code: expect.stringMatching(/^[A-Z0-9]{8}$/),
            created_by: "user-1"
        });
        expect(memberQuery.insert).toHaveBeenCalledWith({
            group_id: "group-1",
            user_id: "user-1"
        });
    });

    it("joins a group with an invite code", async () => {
        const group = {
            id: "group-1",
            name: "Study Squad",
            invite_code: "ABCDEFGH",
            created_by: "user-2",
            created_at: "2026-06-05T09:00:00.000Z"
        };
        const groupQuery = makeQuery({ data: group, error: null });
        const memberQuery = makeQuery({ data: { id: "member-2" }, error: null });
        const countQuery = makeQuery({ data: [{ id: "member-1" }, { id: "member-2" }], error: null });
        const { app } = loadApp({ adminQueries: [groupQuery, memberQuery, countQuery] });

        const response = await authorizedPost(app, "/api/groups/join")
            .send({ inviteCode: " abcd efgh " });

        expect(response.status).toBe(200);
        expect(groupQuery.eq).toHaveBeenCalledWith("invite_code", "ABCDEFGH");
        expect(response.body.group.memberCount).toBe(2);
    });

    it("treats duplicate group joins as successful", async () => {
        const group = {
            id: "group-1",
            name: "Study Squad",
            invite_code: "ABCDEFGH",
            created_by: "user-2",
            created_at: "2026-06-05T09:00:00.000Z"
        };
        const groupQuery = makeQuery({ data: group, error: null });
        const memberQuery = makeQuery({ data: null, error: { code: "23505" } });
        const countQuery = makeQuery({ data: [{ id: "member-1" }, { id: "member-2" }], error: null });
        const { app } = loadApp({ adminQueries: [groupQuery, memberQuery, countQuery] });

        const response = await authorizedPost(app, "/api/groups/join")
            .send({ inviteCode: "ABCDEFGH" });

        expect(response.status).toBe(200);
        expect(response.body.group.memberCount).toBe(2);
    });

    it("rejects leaderboard reads for non-members", async () => {
        const membershipQuery = makeQuery({ data: null, error: null });
        const { app } = loadApp({ adminQueries: [membershipQuery] });

        const response = await authorizedGet(app, "/api/groups/group-1/leaderboard");

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ error: "You are not a member of this group" });
    });

    it("ranks group members by all-time locked-in seconds", async () => {
        const membershipQuery = makeQuery({ data: { id: "member-1" }, error: null });
        const membersQuery = makeQuery({
            data: [
                { user_id: "user-1" },
                { user_id: "user-2" }
            ],
            error: null
        });
        const sessionsQuery = makeQuery({
            data: [
                {
                    user_id: "user-1",
                    total_duration_seconds: 120,
                    started_at: "2026-06-05T09:00:00.000Z",
                    ended_at: "2026-06-05T09:01:00.000Z"
                },
                {
                    user_id: "user-2",
                    total_duration_seconds: 60,
                    started_at: "2026-06-05T09:00:00.000Z",
                    ended_at: "2026-06-05T09:05:00.000Z"
                }
            ],
            error: null
        });
        const pointsQuery = makeQuery({
            data: [
                { user_id: "user-1", points: 40 },
                { user_id: "user-2", points: 90 }
            ],
            error: null
        });
        const { app } = loadApp({
            adminQueries: [membershipQuery, membersQuery, sessionsQuery, pointsQuery],
            usersById: {
                "user-1": { id: "user-1", email: "alice@example.com" },
                "user-2": { id: "user-2", email: "bob@example.com" }
            }
        });

        const response = await authorizedGet(app, "/api/groups/group-1/leaderboard");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            focusPointsAvailable: true,
            leaderboard: [
                {
                    rank: 1,
                    userId: "user-1",
                    displayName: "alice",
                    lockedSeconds: 60,
                    focusPoints: 40,
                    isCurrentUser: true
                },
                {
                    rank: 2,
                    userId: "user-2",
                    displayName: "bob",
                    lockedSeconds: 60,
                    focusPoints: 90,
                    isCurrentUser: false
                }
            ]
        });
        expect(sessionsQuery.not).toHaveBeenCalledWith("ended_at", "is", null);
        expect(pointsQuery.limit).toHaveBeenCalledWith(10000);
    });

    it("sums multiple focus point rows per user for the leaderboard", async () => {
        const membershipQuery = makeQuery({ data: { id: "member-1" }, error: null });
        const membersQuery = makeQuery({
            data: [{ user_id: "user-1" }, { user_id: "user-2" }],
            error: null
        });
        const sessionsQuery = makeQuery({ data: [], error: null });
        const pointsQuery = makeQuery({
            data: [
                { user_id: "user-1", points: 10 },
                { user_id: "user-1", points: 30 },
                { user_id: "user-2", points: 90 }
            ],
            error: null
        });
        const { app } = loadApp({
            adminQueries: [membershipQuery, membersQuery, sessionsQuery, pointsQuery],
            usersById: {
                "user-1": { id: "user-1", email: "alice@example.com" },
                "user-2": { id: "user-2", email: "bob@example.com" }
            }
        });

        const response = await authorizedGet(app, "/api/groups/group-1/leaderboard");

        expect(response.status).toBe(200);
        expect(response.body.focusPointsAvailable).toBe(true);
        const byUserId = Object.fromEntries(
            response.body.leaderboard.map((entry) => [entry.userId, entry.focusPoints])
        );
        expect(byUserId).toEqual({
            "user-1": 40,
            "user-2": 90
        });
        const pointsRanked = [...response.body.leaderboard].sort(
            (left, right) => right.focusPoints - left.focusPoints
        );
        expect(pointsRanked[0].userId).toBe("user-2");
        expect(pointsRanked[1].userId).toBe("user-1");
    });

    it("marks focus points unavailable when the points table is missing", async () => {
        const membershipQuery = makeQuery({ data: { id: "member-1" }, error: null });
        const membersQuery = makeQuery({
            data: [{ user_id: "user-1" }],
            error: null
        });
        const sessionsQuery = makeQuery({ data: [], error: null });
        const pointsQuery = makeQuery({
            data: null,
            error: {
                code: "PGRST205",
                message: "Could not find the table 'public.focus_session_points' in the schema cache"
            }
        });
        const { app } = loadApp({
            adminQueries: [membershipQuery, membersQuery, sessionsQuery, pointsQuery],
            usersById: {
                "user-1": { id: "user-1", email: "alice@example.com" }
            }
        });

        const response = await authorizedGet(app, "/api/groups/group-1/leaderboard");

        expect(response.status).toBe(200);
        expect(response.body.focusPointsAvailable).toBe(false);
        expect(response.body.leaderboard).toEqual([
            {
                rank: 1,
                userId: "user-1",
                displayName: "alice",
                lockedSeconds: 0,
                focusPoints: 0,
                isCurrentUser: true
            }
        ]);
    });

    it("returns an actionable error when group tables are missing", async () => {
        const membershipQuery = makeQuery({
            data: null,
            error: {
                code: "PGRST205",
                message: "Could not find the table 'public.group_members' in the schema cache"
            }
        });
        const { app } = loadApp({ adminQueries: [membershipQuery] });

        const response = await authorizedGet(app, "/api/groups");

        expect(response.status).toBe(503);
        expect(response.body).toEqual({
            error: "Group tables are not available. Run Supabase migration 003_leaderboard_groups.sql."
        });
    });

    it("syncs selected worst-time options into matching default groups", async () => {
        const defaultGroups = [
            { id: "group-late", name: "Late night", invite_code: "LATENITE", created_by: null, created_at: "2026-06-05T09:00:00.000Z", default_group_key: "late_night" },
            { id: "group-morning", name: "First thing morning", invite_code: "MORNING1", created_by: null, created_at: "2026-06-05T09:00:00.000Z", default_group_key: "first_thing_morning" },
            { id: "group-meals", name: "Meals", invite_code: "MEALS000", created_by: null, created_at: "2026-06-05T09:00:00.000Z", default_group_key: "meals" },
            { id: "group-work", name: "Work hours", invite_code: "WORKHOUR", created_by: null, created_at: "2026-06-05T09:00:00.000Z", default_group_key: "work_hours" }
        ];
        const existingDefaultGroupsQuery = makeQuery({ data: defaultGroups, error: null });
        const finalDefaultGroupsQuery = makeQuery({ data: defaultGroups, error: null });
        const currentDefaultMembershipsQuery = makeQuery({ data: [], error: null });
        const lateMembershipQuery = makeQuery({ data: { id: "member-late" }, error: null });
        const mealsMembershipQuery = makeQuery({ data: { id: "member-meals" }, error: null });
        const userMembershipsQuery = makeQuery({
            data: [{ group_id: "group-late" }, { group_id: "group-meals" }],
            error: null
        });
        const groupsQuery = makeQuery({
            data: [defaultGroups[0], defaultGroups[2]],
            error: null
        });
        const allMembersQuery = makeQuery({
            data: [{ group_id: "group-late" }, { group_id: "group-meals" }],
            error: null
        });
        const { app } = loadApp({
            adminQueries: [
                existingDefaultGroupsQuery,
                finalDefaultGroupsQuery,
                currentDefaultMembershipsQuery,
                lateMembershipQuery,
                mealsMembershipQuery,
                userMembershipsQuery,
                groupsQuery,
                allMembersQuery
            ]
        });

        const response = await authorizedPost(app, "/api/groups/defaults/sync")
            .send({ scrollingWorst: ["Late night", "Meals"] });

        expect(response.status).toBe(200);
        expect(lateMembershipQuery.insert).toHaveBeenCalledWith({
            group_id: "group-late",
            user_id: "user-1"
        });
        expect(mealsMembershipQuery.insert).toHaveBeenCalledWith({
            group_id: "group-meals",
            user_id: "user-1"
        });
        expect(response.body.groups.map((group) => group.name)).toEqual(["Late night", "Meals"]);
    });

    it("leaves unselected default groups without touching custom groups", async () => {
        const defaultGroups = [
            { id: "group-late", name: "Late night", invite_code: "LATENITE", created_by: null, created_at: "2026-06-05T09:00:00.000Z", default_group_key: "late_night" },
            { id: "group-morning", name: "First thing morning", invite_code: "MORNING1", created_by: null, created_at: "2026-06-05T09:00:00.000Z", default_group_key: "first_thing_morning" },
            { id: "group-meals", name: "Meals", invite_code: "MEALS000", created_by: null, created_at: "2026-06-05T09:00:00.000Z", default_group_key: "meals" },
            { id: "group-work", name: "Work hours", invite_code: "WORKHOUR", created_by: null, created_at: "2026-06-05T09:00:00.000Z", default_group_key: "work_hours" }
        ];
        const customGroup = {
            id: "group-custom",
            name: "hello",
            invite_code: "ABCDEFGH",
            created_by: "user-1",
            created_at: "2026-06-05T09:00:00.000Z"
        };
        const existingDefaultGroupsQuery = makeQuery({ data: defaultGroups, error: null });
        const finalDefaultGroupsQuery = makeQuery({ data: defaultGroups, error: null });
        const currentDefaultMembershipsQuery = makeQuery({
            data: [
                { id: "member-late", group_id: "group-late" },
                { id: "member-meals", group_id: "group-meals" }
            ],
            error: null
        });
        const deleteMealsQuery = makeQuery({ data: [], error: null });
        const userMembershipsQuery = makeQuery({
            data: [{ group_id: "group-late" }, { group_id: "group-custom" }],
            error: null
        });
        const groupsQuery = makeQuery({
            data: [defaultGroups[0], customGroup],
            error: null
        });
        const allMembersQuery = makeQuery({
            data: [{ group_id: "group-late" }, { group_id: "group-custom" }],
            error: null
        });
        const { app } = loadApp({
            adminQueries: [
                existingDefaultGroupsQuery,
                finalDefaultGroupsQuery,
                currentDefaultMembershipsQuery,
                deleteMealsQuery,
                userMembershipsQuery,
                groupsQuery,
                allMembersQuery
            ]
        });

        const response = await authorizedPost(app, "/api/groups/defaults/sync")
            .send({ scrollingWorst: ["Late night"] });

        expect(response.status).toBe(200);
        expect(deleteMealsQuery.delete).toHaveBeenCalled();
        expect(deleteMealsQuery.eq).toHaveBeenCalledWith("id", "member-meals");
        expect(deleteMealsQuery.eq).not.toHaveBeenCalledWith("id", "member-custom");
        expect(response.body.groups.map((group) => group.name)).toEqual(["hello", "Late night"]);
    });

    it("rejects unknown worst-time options", async () => {
        const { app } = loadApp({ adminQueries: [] });

        const response = await authorizedPost(app, "/api/groups/defaults/sync")
            .send({ scrollingWorst: ["Lunch break"] });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: "scrollingWorst contains unknown options" });
    });

    it("returns an actionable error when default group metadata is missing", async () => {
        const defaultGroupsQuery = makeQuery({
            data: null,
            error: {
                code: "PGRST204",
                message: "Could not find the 'default_group_key' column of 'leaderboard_groups' in the schema cache"
            }
        });
        const { app } = loadApp({ adminQueries: [defaultGroupsQuery] });

        const response = await authorizedPost(app, "/api/groups/defaults/sync")
            .send({ scrollingWorst: ["Late night"] });

        expect(response.status).toBe(503);
        expect(response.body).toEqual({
            error: "Default groups are not available. Run Supabase migration 005_default_leaderboard_groups.sql."
        });
    });
});
