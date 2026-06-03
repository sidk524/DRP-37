const express = require("express");
const helmet = require("helmet");
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

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
const SESSION_FIELDS = "id,user_id,apps_blocked,total_duration_seconds,started_at,ended_at";

app.disable("x-powered-by");
app.use(helmet());
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

const createSession = async (userId, appsBlocked, totalDurationSeconds) => {
    return supabaseAdmin
        .from("block_sessions")
        .insert({
            user_id: userId,
            apps_blocked: appsBlocked,
            total_duration_seconds: totalDurationSeconds,
            started_at: new Date().toISOString()
        })
        .select(SESSION_FIELDS)
        .single();
};

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
            totalDurationSeconds,
            sessionId
        } = req.body || {};

        if (active === true) {
            if (!Array.isArray(appsBlocked)) {
                res.status(400).json({ error: "appsBlocked must be an array" });
                return;
            }

            if (!Number.isInteger(totalDurationSeconds) || totalDurationSeconds <= 0) {
                res.status(400).json({ error: "totalDurationSeconds must be a positive integer" });
                return;
            }

            if (appsBlocked.some((packageName) => typeof packageName !== "string" || !packageName.trim())) {
                res.status(400).json({ error: "appsBlocked must contain package names" });
                return;
            }

            const { error: closeExistingError } = await closeSession(req.user.id);

            if (closeExistingError) throw closeExistingError;

            let { data, error } = await createSession(req.user.id, appsBlocked, totalDurationSeconds);
            if (error && error.code === "23505") {
                const { error: retryCloseError } = await closeSession(req.user.id);
                if (retryCloseError) throw retryCloseError;
                ({ data, error } = await createSession(req.user.id, appsBlocked, totalDurationSeconds));
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
    const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600
        ? err.status
        : 500;
    res.status(status).json({ error: status === 500 ? "Internal server error" : err.message });
});

module.exports = app;
