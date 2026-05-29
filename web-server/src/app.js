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
};

app.get("/api/session/current", requireSupabase, requireUser, async (req, res, next) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("block_sessions")
            .select("id,user_id,apps_blocked,total_duration_seconds,started_at,ended_at")
            .eq("user_id", req.user.id)
            .is("ended_at", null)
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;

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
            startedAt,
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

            const { error: closeExistingError } = await supabaseAdmin
                .from("block_sessions")
                .update({ ended_at: new Date().toISOString() })
                .eq("user_id", req.user.id)
                .is("ended_at", null);

            if (closeExistingError) throw closeExistingError;

            const { data, error } = await supabaseAdmin
                .from("block_sessions")
                .insert({
                    user_id: req.user.id,
                    apps_blocked: appsBlocked,
                    total_duration_seconds: totalDurationSeconds,
                    started_at: startedAt || new Date().toISOString()
                })
                .select("id,user_id,apps_blocked,total_duration_seconds,started_at,ended_at")
                .single();

            if (error) throw error;

            res.status(201).json({ session: data });
            return;
        }

        if (active === false) {
            let query = supabaseAdmin
                .from("block_sessions")
                .update({ ended_at: new Date().toISOString() })
                .eq("user_id", req.user.id)
                .is("ended_at", null);

            if (sessionId) {
                query = query.eq("id", sessionId);
            }

            const { data, error } = await query
                .select("id,user_id,apps_blocked,total_duration_seconds,started_at,ended_at");

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
    res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
