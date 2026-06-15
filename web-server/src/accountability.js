const PRESETS = {
    lock_in: "Lock in",
    stay_focused: "Stay focused",
    youve_got_this: "You've got this"
};

const publicPreferences = (row) => ({
    shareActivity: row?.share_activity !== false,
    receiveFriendAlerts: row?.receive_friend_alerts !== false
});

function registerAccountabilityRoutes(app, deps) {
    const { supabaseAdmin, requireSupabase, requireUser, hub, displayNameForUser } = deps;

    async function preferencesFor(userId) {
        const { data, error } = await supabaseAdmin.from("accountability_preferences")
            .select("share_activity,receive_friend_alerts").eq("user_id", userId).maybeSingle();
        if (error) throw error;
        return publicPreferences(data);
    }

    async function customGroupsFor(userId) {
        const { data: memberships, error } = await supabaseAdmin.from("group_members")
            .select("group_id").eq("user_id", userId);
        if (error) throw error;
        const ids = [...new Set((memberships || []).map((row) => row.group_id).filter(Boolean))];
        if (!ids.length) return [];
        const result = await supabaseAdmin.from("leaderboard_groups")
            .select("id,name,default_group_key").in("id", ids).is("default_group_key", null);
        if (result.error) throw result.error;
        return result.data || [];
    }

    async function unreadCountFor(userId) {
        const notifications = await supabaseAdmin.from("accountability_notifications")
            .select("id").eq("recipient_user_id", userId).is("read_at", null);
        if (notifications.error) throw notifications.error;
        const messages = await supabaseAdmin.from("accountability_messages")
            .select("id").eq("recipient_user_id", userId).is("read_at", null);
        if (messages.error) throw messages.error;
        return (notifications.data || []).length + (messages.data || []).length;
    }

    async function broadcastUnread(userId) {
        hub.broadcastEvent(userId, {
            type: "accountability.unread",
            unreadCount: await unreadCountFor(userId)
        });
    }

    app.get("/api/accountability/preferences", requireSupabase, requireUser, async (req, res, next) => {
        try { res.json({ preferences: await preferencesFor(req.user.id) }); } catch (error) { next(error); }
    });

    app.put("/api/accountability/preferences", requireSupabase, requireUser, async (req, res, next) => {
        try {
            const { shareActivity, receiveFriendAlerts } = req.body || {};
            if (typeof shareActivity !== "boolean" || typeof receiveFriendAlerts !== "boolean") {
                return res.status(400).json({ error: "shareActivity and receiveFriendAlerts must be booleans" });
            }
            const { data, error } = await supabaseAdmin.from("accountability_preferences").upsert({
                user_id: req.user.id,
                share_activity: shareActivity,
                receive_friend_alerts: receiveFriendAlerts,
                updated_at: new Date().toISOString()
            }, { onConflict: "user_id" }).select("share_activity,receive_friend_alerts").single();
            if (error) throw error;
            res.json({ preferences: publicPreferences(data) });
        } catch (error) { next(error); }
    });

    app.get("/api/groups/:groupId/presence", requireSupabase, requireUser, async (req, res, next) => {
        try {
            const groupResult = await supabaseAdmin.from("leaderboard_groups")
                .select("id,default_group_key").eq("id", req.params.groupId).maybeSingle();
            if (groupResult.error) throw groupResult.error;
            if (!groupResult.data) {
                return res.status(404).json({ error: "Group not found" });
            }
            const membership = await supabaseAdmin.from("group_members").select("id")
                .eq("group_id", req.params.groupId).eq("user_id", req.user.id).maybeSingle();
            if (membership.error) throw membership.error;
            if (!membership.data) return res.status(403).json({ error: "You are not a member of this group" });
            const members = await supabaseAdmin.from("group_members").select("user_id").eq("group_id", req.params.groupId);
            if (members.error) throw members.error;
            const ids = [...new Set((members.data || []).map((row) => row.user_id).filter(Boolean))];
            const preferenceRows = ids.length
                ? await supabaseAdmin.from("accountability_preferences").select("user_id,share_activity").in("user_id", ids)
                : { data: [], error: null };
            if (preferenceRows.error) throw preferenceRows.error;
            const hidden = new Set((preferenceRows.data || []).filter((row) => !row.share_activity).map((row) => row.user_id));
            const visible = ids.filter((id) => !hidden.has(id));
            const sessions = visible.length
                ? await supabaseAdmin.from("block_sessions").select("user_id,started_at,total_duration_seconds,mode")
                    .in("user_id", visible).is("ended_at", null)
                : { data: [], error: null };
            if (sessions.error) throw sessions.error;
            const now = Date.now();
            const active = new Map((sessions.data || [])
                .filter((row) => new Date(row.started_at).getTime() + row.total_duration_seconds * 1000 > now)
                .map((row) => [row.user_id, row]));
            const presence = await Promise.all(
                visible
                    .filter((userId) => active.has(userId))
                    .map(async (userId) => {
                        const session = active.get(userId);
                        return {
                            userId,
                            displayName: await displayNameForUser(userId),
                            active: true,
                            mode: session?.mode || null,
                            startedAt: session?.started_at || null,
                            endsAt: new Date(new Date(session.started_at).getTime() + session.total_duration_seconds * 1000).toISOString()
                        };
                    })
            );
            res.json({ presence });
        } catch (error) { next(error); }
    });

    app.post("/api/accountability/attempts", requireSupabase, requireUser, async (req, res, next) => {
        try {
            if (!(await preferencesFor(req.user.id)).shareActivity) {
                return res.status(202).json({ ignored: true, reason: "sharing_disabled" });
            }
            const targetType = req.body?.targetType;
            const targetKey = String(req.body?.targetKey || "").trim();
            const targetLabel = String(req.body?.targetLabel || targetKey).trim().slice(0, 120);
            const idempotencyKey = String(req.body?.idempotencyKey || "").trim();
            if (!["app", "domain"].includes(targetType) || !targetKey || !targetLabel || !idempotencyKey) {
                return res.status(400).json({ error: "targetType, targetKey, targetLabel and idempotencyKey are required" });
            }
            const sessionResult = await supabaseAdmin.from("block_sessions")
                .select("id,apps_blocked,domains_blocked,mode,started_at,total_duration_seconds")
                .eq("user_id", req.user.id).is("ended_at", null).maybeSingle();
            if (sessionResult.error) throw sessionResult.error;
            const session = sessionResult.data;
            const targets = targetType === "app" ? session?.apps_blocked : session?.domains_blocked;
            const expiresAt = session
                ? new Date(session.started_at).getTime() + session.total_duration_seconds * 1000
                : 0;
            if (!session || expiresAt <= Date.now() || !Array.isArray(targets) || !targets.includes(targetKey)) {
                return res.status(400).json({ error: "Target is not blocked by the active session" });
            }
            const groups = await customGroupsFor(req.user.id);
            if (!groups.length) return res.status(202).json({ ignored: true, reason: "no_custom_groups" });
            const attemptResult = await supabaseAdmin.from("accountability_attempts").insert({
                actor_user_id: req.user.id,
                block_session_id: session.id,
                target_type: targetType,
                target_key: targetKey,
                target_label: targetLabel,
                mode: session.mode,
                idempotency_key: idempotencyKey
            }).select("id,actor_user_id,target_type,target_key,target_label,mode,created_at").single();
            if (attemptResult.error?.code === "23505") return res.json({ duplicate: true });
            if (attemptResult.error) throw attemptResult.error;
            const attempt = attemptResult.data;
            const groupRows = groups.map((group) => ({ attempt_id: attempt.id, group_id: group.id, group_name: group.name }));
            const attemptGroups = await supabaseAdmin.from("accountability_attempt_groups").insert(groupRows);
            if (attemptGroups.error) throw attemptGroups.error;
            const memberships = await supabaseAdmin.from("group_members")
                .select("group_id,user_id").in("group_id", groups.map((group) => group.id));
            if (memberships.error) throw memberships.error;
            const byRecipient = new Map();
            for (const member of memberships.data || []) {
                if (member.user_id === req.user.id) continue;
                const group = groups.find((item) => item.id === member.group_id);
                if (!byRecipient.has(member.user_id)) byRecipient.set(member.user_id, []);
                byRecipient.get(member.user_id).push({ id: group.id, name: group.name });
            }
            const recipientIds = [...byRecipient.keys()];
            const recipientPrefs = recipientIds.length
                ? await supabaseAdmin.from("accountability_preferences").select("user_id,receive_friend_alerts").in("user_id", recipientIds)
                : { data: [], error: null };
            if (recipientPrefs.error) throw recipientPrefs.error;
            const disabled = new Set((recipientPrefs.data || []).filter((row) => !row.receive_friend_alerts).map((row) => row.user_id));
            const rows = recipientIds.filter((id) => !disabled.has(id)).map((id) => ({
                attempt_id: attempt.id, recipient_user_id: id, shared_groups: byRecipient.get(id)
            }));
            const notificationResult = rows.length
                ? await supabaseAdmin.from("accountability_notifications").insert(rows)
                    .select("id,attempt_id,recipient_user_id,shared_groups,read_at,created_at")
                : { data: [], error: null };
            if (notificationResult.error) throw notificationResult.error;
            const actorDisplayName = await displayNameForUser(req.user.id);
            for (const notification of notificationResult.data || []) {
                hub.broadcastEvent(notification.recipient_user_id, {
                    type: "accountability.attempt",
                    notification: { ...notification, attempt, actorDisplayName }
                });
                broadcastUnread(notification.recipient_user_id).catch(() => {});
            }
            res.status(201).json({ attempt, recipientCount: (notificationResult.data || []).length });
        } catch (error) { next(error); }
    });

    app.get("/api/accountability/inbox", requireSupabase, requireUser, async (req, res, next) => {
        try {
            const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
            const notifications = await supabaseAdmin.from("accountability_notifications")
                .select("id,attempt_id,shared_groups,read_at,created_at").eq("recipient_user_id", req.user.id).limit(limit);
            if (notifications.error) throw notifications.error;
            const messages = await supabaseAdmin.from("accountability_messages")
                .select("id,attempt_id,sender_user_id,preset_key,body,read_at,created_at").eq("recipient_user_id", req.user.id).limit(limit);
            if (messages.error) throw messages.error;
            const attemptIds = [...new Set([...(notifications.data || []), ...(messages.data || [])].map((row) => row.attempt_id))];
            const attempts = attemptIds.length
                ? await supabaseAdmin.from("accountability_attempts")
                    .select("id,actor_user_id,target_type,target_key,target_label,mode,created_at").in("id", attemptIds)
                : { data: [], error: null };
            if (attempts.error) throw attempts.error;
            const byId = new Map((attempts.data || []).map((row) => [row.id, row]));
            const actorIds = [...new Set((attempts.data || []).map((row) => row.actor_user_id))];
            const senderIds = [...new Set((messages.data || []).map((row) => row.sender_user_id))];
            const nameIds = [...new Set([...actorIds, ...senderIds])];
            const names = new Map(await Promise.all(nameIds.map(async (id) => [id, await displayNameForUser(id)])));
            const items = [
                ...(notifications.data || []).map((row) => ({
                    kind: "attempt",
                    ...row,
                    attempt: byId.get(row.attempt_id),
                    actorDisplayName: names.get(byId.get(row.attempt_id)?.actor_user_id) || "Friend"
                })),
                ...(messages.data || []).map((row) => ({
                    kind: "message",
                    ...row,
                    attempt: byId.get(row.attempt_id),
                    senderDisplayName: names.get(row.sender_user_id) || "Friend"
                }))
            ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, limit);
            res.json({ items, unreadCount: await unreadCountFor(req.user.id) });
        } catch (error) { next(error); }
    });

    app.post("/api/accountability/notifications/:notificationId/read", requireSupabase, requireUser, async (req, res, next) => {
        try {
            const result = await supabaseAdmin.from("accountability_notifications").update({ read_at: new Date().toISOString() })
                .eq("id", req.params.notificationId).eq("recipient_user_id", req.user.id).select("id").maybeSingle();
            if (result.error) throw result.error;
            if (!result.data) return res.status(404).json({ error: "Notification not found" });
            const unreadCount = await unreadCountFor(req.user.id);
            res.json({ unreadCount });
            hub.broadcastEvent(req.user.id, { type: "accountability.unread", unreadCount });
        } catch (error) { next(error); }
    });

    app.post("/api/accountability/messages/:messageId/read", requireSupabase, requireUser, async (req, res, next) => {
        try {
            const result = await supabaseAdmin.from("accountability_messages").update({ read_at: new Date().toISOString() })
                .eq("id", req.params.messageId).eq("recipient_user_id", req.user.id).select("id").maybeSingle();
            if (result.error) throw result.error;
            if (!result.data) return res.status(404).json({ error: "Message not found" });
            const unreadCount = await unreadCountFor(req.user.id);
            res.json({ unreadCount });
            hub.broadcastEvent(req.user.id, { type: "accountability.unread", unreadCount });
        } catch (error) { next(error); }
    });

    app.post("/api/accountability/inbox/clear", requireSupabase, requireUser, async (req, res, next) => {
        try {
            const notifications = await supabaseAdmin.from("accountability_notifications")
                .delete().eq("recipient_user_id", req.user.id).select("id");
            if (notifications.error) throw notifications.error;
            const messages = await supabaseAdmin.from("accountability_messages")
                .delete().eq("recipient_user_id", req.user.id).select("id");
            if (messages.error) throw messages.error;
            const clearedCount = (notifications.data || []).length + (messages.data || []).length;
            res.json({ unreadCount: 0, clearedCount });
            hub.broadcastEvent(req.user.id, { type: "accountability.unread", unreadCount: 0 });
        } catch (error) { next(error); }
    });

    app.post("/api/accountability/attempts/:attemptId/messages", requireSupabase, requireUser, async (req, res, next) => {
        try {
            const presetKey = req.body?.presetKey == null ? null : String(req.body.presetKey);
            const body = String(presetKey ? PRESETS[presetKey] || "" : req.body?.body || "").trim();
            if ((presetKey && !PRESETS[presetKey]) || !body || body.length > 280) {
                return res.status(400).json({ error: "Use a supported preset or a message of 1-280 characters" });
            }
            const authorization = await supabaseAdmin.from("accountability_notifications").select("id")
                .eq("attempt_id", req.params.attemptId).eq("recipient_user_id", req.user.id).maybeSingle();
            if (authorization.error) throw authorization.error;
            if (!authorization.data) return res.status(403).json({ error: "You cannot reply to this attempt" });
            const attemptResult = await supabaseAdmin.from("accountability_attempts").select("id,actor_user_id,target_label,mode")
                .eq("id", req.params.attemptId).maybeSingle();
            if (attemptResult.error) throw attemptResult.error;
            if (!attemptResult.data) return res.status(404).json({ error: "Attempt not found" });
            const result = await supabaseAdmin.from("accountability_messages").insert({
                attempt_id: req.params.attemptId, sender_user_id: req.user.id,
                recipient_user_id: attemptResult.data.actor_user_id, preset_key: presetKey, body
            }).select("id,attempt_id,sender_user_id,recipient_user_id,preset_key,body,read_at,created_at").single();
            if (result.error) throw result.error;
            hub.broadcastEvent(attemptResult.data.actor_user_id, {
                type: "accountability.message",
                message: {
                    id: result.data.id,
                    ...result.data,
                    attempt: attemptResult.data,
                    senderDisplayName: await displayNameForUser(req.user.id)
                }
            });
            broadcastUnread(attemptResult.data.actor_user_id).catch(() => {});
            res.status(201).json({ message: result.data });
        } catch (error) { next(error); }
    });
}

module.exports = { registerAccountabilityRoutes, publicPreferences, PRESETS };
