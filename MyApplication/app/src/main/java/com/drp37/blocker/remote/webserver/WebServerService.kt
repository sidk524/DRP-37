package com.drp37.blocker.remote.webserver

import com.drp37.blocker.BuildConfig
import com.drp37.blocker.auth.AuthService
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object WebServerService {
    private val httpClient by lazy {
        HttpClient(Android) {
            engine {
                connectTimeout = 10_000
                socketTimeout = 10_000
            }
        }
    }
    suspend fun getCurrentSession(): BlockSessionRecord? {
        val response = request(method = "GET", path = "/api/session/current")
        val session = response.optJSONObject("session") ?: return null
        return session.toBlockSessionRecord()
    }

    suspend fun createSession(
        blockGroupId: String,
        totalDurationSeconds: Int,
        mode: String = "reflect"
    ): BlockSessionRecord {
        val body = JSONObject()
            .put("active", true)
            .put("blockGroupId", blockGroupId)
            .put("totalDurationSeconds", totalDurationSeconds)
            .put("mode", normalizeMode(mode))

        val response = request(method = "PUT", path = "/api/session/current", body = body)
        val session = response.optJSONObject("session")
            ?: throw IOException("Server did not return a block session.")
        return session.toBlockSessionRecord()
    }

    suspend fun patchSessionMode(mode: String): BlockSessionRecord? {
        val body = JSONObject().put("mode", normalizeMode(mode))
        val response = request(method = "PATCH", path = "/api/session/current", body = body)
        val session = response.optJSONObject("session") ?: return null
        return session.toBlockSessionRecord()
    }

    suspend fun listBlockGroups(): List<BlockGroup> {
        val response = request(method = "GET", path = "/api/block-groups")
        return response.optJSONArray("blockGroups")?.toObjectList { toBlockGroup() }.orEmpty()
    }

    suspend fun createBlockGroup(
        name: String,
        targets: List<String> = emptyList(),
        appsBlocked: List<String> = emptyList(),
        domainsBlocked: List<String> = emptyList()
    ): BlockGroup {
        val body = JSONObject()
            .put("name", name.trim())
            .put("targets", JSONArray(targets))
            .put("appsBlocked", JSONArray(appsBlocked))
            .put("domainsBlocked", JSONArray(domainsBlocked))

        val response = request(method = "POST", path = "/api/block-groups", body = body)
        val group = response.optJSONObject("blockGroup")
            ?: throw IOException("Server did not return a block group.")
        return group.toBlockGroup()
    }

    suspend fun updateBlockGroup(
        groupId: String,
        name: String,
        targets: List<String>,
        appsBlocked: List<String>,
        domainsBlocked: List<String>
    ): BlockGroup {
        val encodedId = URLEncoder.encode(groupId, StandardCharsets.UTF_8.name())
        val body = JSONObject()
            .put("name", name.trim())
            .put("targets", JSONArray(targets))
            .put("appsBlocked", JSONArray(appsBlocked))
            .put("domainsBlocked", JSONArray(domainsBlocked))

        val response = request(method = "PUT", path = "/api/block-groups/$encodedId", body = body)
        val group = response.optJSONObject("blockGroup")
            ?: throw IOException("Server did not return a block group.")
        return group.toBlockGroup()
    }

    suspend fun deleteBlockGroup(groupId: String) {
        val encodedId = URLEncoder.encode(groupId, StandardCharsets.UTF_8.name())
        request(method = "DELETE", path = "/api/block-groups/$encodedId")
    }

    suspend fun endSession(sessionId: String?, reason: String = "manual"): FocusPointsRecord? {
        val body = JSONObject()
            .put("active", false)
            .put("reason", if (reason == "expired") "expired" else "manual")
        if (!sessionId.isNullOrBlank()) {
            body.put("sessionId", sessionId)
        }
        val response = request(method = "PUT", path = "/api/session/current", body = body)
        val completed = response.optJSONObject("completed") ?: return null
        return completed.toFocusPointsRecord()
    }

    suspend fun loadOnboarding(): OnboardingSettings? {
        val response = request(method = "GET", path = "/api/onboarding")
        val onboarding = response.optJSONObject("onboarding") ?: return null
        return onboarding.toOnboardingSettings()
    }

    suspend fun saveOnboarding(settings: OnboardingSettings): OnboardingSettings {
        val body = JSONObject()
            .put("doMoreOf", JSONArray(settings.goals))
            .put("scrollingWorst", JSONArray(settings.scrollingWorst))
            .put("futureMessage", settings.futureMessage.trim())
            .put("strictness", normalizeStrictness(settings.strictness))

        val response = request(method = "PUT", path = "/api/onboarding", body = body)
        val onboarding = response.optJSONObject("onboarding")
            ?: throw IOException("Server did not return onboarding settings.")
        return onboarding.toOnboardingSettings()
    }

    suspend fun getUserTotalPoints(): Int {
        val response = request(method = "GET", path = "/api/focus-points/total")
        return response.optInt("total", 0)
    }

    suspend fun listGroups(): List<GroupSummary> {
        val response = request(method = "GET", path = "/api/groups")
        return response.optJSONArray("groups")?.toObjectList { toGroupSummary() }.orEmpty()
    }

    suspend fun createGroup(name: String): GroupSummary {
        val body = JSONObject().put("name", name.trim())
        val response = request(method = "POST", path = "/api/groups", body = body)
        val group = response.optJSONObject("group")
            ?: throw IOException("Server did not return a group.")
        return group.toGroupSummary()
    }

    suspend fun joinGroup(inviteCode: String): GroupSummary {
        val body = JSONObject().put("inviteCode", inviteCode.trim())
        val response = request(method = "POST", path = "/api/groups/join", body = body)
        val group = response.optJSONObject("group")
            ?: throw IOException("Server did not return a group.")
        return group.toGroupSummary()
    }

    suspend fun getGroupLeaderboard(groupId: String): GroupLeaderboard {
        val encodedId = URLEncoder.encode(groupId, StandardCharsets.UTF_8.name())
        val response = request(method = "GET", path = "/api/groups/$encodedId/leaderboard")
        val entries = response.optJSONArray("leaderboard")?.toObjectList { toLeaderboardEntry() }.orEmpty()
        val focusPointsAvailable = when {
            response.has("focusPointsAvailable") -> response.optBoolean("focusPointsAvailable", true)
            else -> true
        }
        return GroupLeaderboard(entries = entries, focusPointsAvailable = focusPointsAvailable)
    }

    suspend fun getGroupPresence(groupId: String): List<GroupPresence> {
        val encodedId = URLEncoder.encode(groupId, StandardCharsets.UTF_8.name())
        val response = request(method = "GET", path = "/api/groups/$encodedId/presence")
        return response.optJSONArray("presence")?.toObjectList { toGroupPresence() }.orEmpty()
    }

    suspend fun getAccountabilityPreferences(): AccountabilityPreferences {
        val value = request(method = "GET", path = "/api/accountability/preferences").getJSONObject("preferences")
        return AccountabilityPreferences(
            shareActivity = value.optBoolean("shareActivity", true),
            receiveFriendAlerts = value.optBoolean("receiveFriendAlerts", true)
        )
    }

    suspend fun updateAccountabilityPreferences(value: AccountabilityPreferences): AccountabilityPreferences {
        val response = request(
            method = "PUT",
            path = "/api/accountability/preferences",
            body = JSONObject()
                .put("shareActivity", value.shareActivity)
                .put("receiveFriendAlerts", value.receiveFriendAlerts)
        ).getJSONObject("preferences")
        val saved = AccountabilityPreferences(
            shareActivity = response.optBoolean("shareActivity", true),
            receiveFriendAlerts = response.optBoolean("receiveFriendAlerts", true)
        )
        com.drp37.blocker.local.TetherLocalStore.setAccountabilityPreferences(saved.shareActivity, saved.receiveFriendAlerts)
        return saved
    }

    suspend fun reportAccountabilityAttempt(packageName: String, label: String) {
        request(
            method = "POST",
            path = "/api/accountability/attempts",
            body = JSONObject()
                .put("targetType", "app")
                .put("targetKey", packageName)
                .put("targetLabel", label.take(120))
                .put("idempotencyKey", "android:${System.currentTimeMillis()}:${java.util.UUID.randomUUID()}")
        )
    }

    suspend fun getAccountabilityInbox(): Pair<List<AccountabilityInboxItem>, Int> {
        val response = request(method = "GET", path = "/api/accountability/inbox")
        val items = response.optJSONArray("items")?.toObjectList {
            val kind = optString("kind")
            val attempt = optJSONObject("attempt")
            AccountabilityInboxItem(
                id = optString("id"),
                kind = kind,
                attemptId = optString("attempt_id"),
                title = if (kind == "message") "Encouragement" else "${optString("actorDisplayName", "Friend")} opened ${attempt?.optString("target_label", "a blocked app")}",
                detail = if (kind == "message") optString("body") else attempt?.optString("mode", "focus").orEmpty(),
                unread = optString("read_at").isBlank() || optString("read_at") == "null"
            )
        }.orEmpty()
        return items to response.optInt("unreadCount", 0)
    }

    suspend fun markAccountabilityNotificationRead(id: String) {
        request(method = "POST", path = "/api/accountability/notifications/${URLEncoder.encode(id, StandardCharsets.UTF_8.name())}/read")
    }

    suspend fun sendAccountabilityPreset(attemptId: String, presetKey: String) {
        request(
            method = "POST",
            path = "/api/accountability/attempts/${URLEncoder.encode(attemptId, StandardCharsets.UTF_8.name())}/messages",
            body = JSONObject().put("presetKey", presetKey)
        )
    }

    suspend fun sendAccountabilityMessage(attemptId: String, body: String) {
        request(
            method = "POST",
            path = "/api/accountability/attempts/${URLEncoder.encode(attemptId, StandardCharsets.UTF_8.name())}/messages",
            body = JSONObject().put("body", body.trim())
        )
    }


    suspend fun syncDefaultGroups(scrollingWorst: List<String>): List<GroupSummary> {
        val body = JSONObject().put("scrollingWorst", JSONArray(scrollingWorst))
        val response = request(method = "POST", path = "/api/groups/defaults/sync", body = body)
        return response.optJSONArray("groups")?.toObjectList { toGroupSummary() }.orEmpty()
    }

    private suspend fun request(
        method: String,
        path: String,
        body: JSONObject? = null
    ): JSONObject = withContext(Dispatchers.IO) {
        val baseUrl = webServerBaseUrl()
        val accessToken = AuthService.currentAccessToken()
            ?: throw IOException("No active Supabase session.")
        val url = "$baseUrl$path"
        val httpMethod = when (method.uppercase()) {
            "GET" -> HttpMethod.Get
            "POST" -> HttpMethod.Post
            "PUT" -> HttpMethod.Put
            "DELETE" -> HttpMethod.Delete
            else -> HttpMethod.parse(method)
        }

        val response = try {
            httpClient.request(url) {
                this.method = httpMethod
                header("Authorization", "Bearer $accessToken")
                header("Accept", "application/json")
                header("X-Tether-Device-Id", com.drp37.blocker.local.TetherLocalStore.getOrCreateDeviceId())
                if (body != null) {
                    contentType(ContentType.Application.Json)
                    setBody(body.toString())
                }
            }
        } catch (error: Exception) {
            throw mapNetworkError(error, baseUrl)
        }

        val responseCode = response.status.value
        val responseText = response.bodyAsText()
        if (response.status.isSuccess() && responseText.isBlank()) {
            return@withContext JSONObject()
        }
        if (!response.status.isSuccess()) {
            val errorMessage = runCatching {
                JSONObject(responseText).optString("error")
            }.getOrNull().orEmpty()
            throw IOException(errorMessage.ifBlank { "Server returned HTTP $responseCode." })
        }
        JSONObject(responseText)
    }
}

private fun webServerBaseUrl(): String {
    val raw = BuildConfig.WEB_SERVER_URL.trim()
    if (raw.isBlank()) throw IOException("WEB_SERVER_URL is not configured.")
    val withScheme = when {
        raw.startsWith("http://", ignoreCase = true) || raw.startsWith("https://", ignoreCase = true) -> raw
        else -> "http://$raw"
    }
    return withScheme.trimEnd('/')
}

private fun mapNetworkError(cause: Throwable, baseUrl: String): IOException {
    val message = cause.message.orEmpty()
    val causeType = cause::class.simpleName.orEmpty()
    val hint = if (message.contains("connect", ignoreCase = true)) {
        "Cannot reach $baseUrl ($causeType: $message). Rebuild after editing local.properties, try Wi‑Fi, and ensure the server allows inbound TCP 3000."
    } else {
        "Cannot reach $baseUrl ($causeType: $message)."
    }
    return IOException(hint, cause)
}

private fun normalizeStrictness(strictness: String): String {
    return when (strictness) {
        "gentle" -> "gentle"
        "moderate" -> "moderate"
        "hard" -> "hard"
        else -> "moderate"
    }
}

private fun normalizeMode(mode: String): String {
    return when (mode) {
        "breathing" -> "breathing"
        "hard" -> "hard"
        else -> "reflect"
    }
}

internal fun JSONObject.toBlockSessionRecord(): BlockSessionRecord {
    return BlockSessionRecord(
        id = getString("id"),
        userId = getString("user_id"),
        blockGroupId = optString("block_group_id").takeUnless { it.isBlank() || it == "null" },
        canonicalTargets = optJSONArray("canonical_targets")?.toStringList().orEmpty(),
        appsBlocked = optJSONArray("apps_blocked")?.toStringList().orEmpty(),
        domainsBlocked = optJSONArray("domains_blocked")?.toStringList().orEmpty(),
        processTokens = optJSONArray("process_tokens")?.toStringList().orEmpty(),
        totalDurationSeconds = getInt("total_duration_seconds"),
        startedAt = getString("started_at"),
        endedAt = optString("ended_at").takeUnless { it.isBlank() || it == "null" },
        mode = normalizeMode(optString("mode"))
    )
}

private fun JSONObject.toOnboardingSettings(): OnboardingSettings {
    return OnboardingSettings(
        goals = optJSONArray("doMoreOf")?.toStringList().orEmpty(),
        scrollingWorst = optJSONArray("scrollingWorst")?.toStringList().orEmpty(),
        futureMessage = optString("futureMessage").orEmpty(),
        strictness = normalizeStrictness(optString("strictness"))
    )
}

internal fun JSONObject.toFocusPointsRecord(): FocusPointsRecord {
    return FocusPointsRecord(
        id = getString("id"),
        userId = getString("user_id"),
        mode = normalizeMode(optString("mode")),
        actualMs = optLong("actual_ms", 0L),
        plannedMs = optLong("planned_ms", 0L),
        blockedAppsCount = optInt("blocked_apps_count", 1),
        points = optInt("points", 0),
        endedAt = optString("ended_at").orEmpty(),
        createdAt = optString("created_at").orEmpty()
    )
}

private fun JSONObject.toBlockGroup(): BlockGroup {
    return BlockGroup(
        id = getString("id"),
        name = optString("name").orEmpty(),
        systemKey = optString("systemKey").takeUnless { it.isBlank() || it == "null" },
        targets = optJSONArray("targets")?.toStringList().orEmpty(),
        appsBlocked = optJSONArray("appsBlocked")?.toStringList().orEmpty(),
        domainsBlocked = optJSONArray("domainsBlocked")?.toStringList().orEmpty(),
        canonicalTargets = optJSONArray("canonicalTargets")?.toStringList().orEmpty(),
        expandedAppsBlocked = optJSONArray("expandedAppsBlocked")?.toStringList().orEmpty(),
        expandedDomainsBlocked = optJSONArray("expandedDomainsBlocked")?.toStringList().orEmpty(),
        processTokens = optJSONArray("processTokens")?.toStringList().orEmpty()
    )
}

private fun JSONObject.toGroupSummary(): GroupSummary {
    return GroupSummary(
        id = getString("id"),
        name = optString("name").orEmpty(),
        inviteCode = optString("inviteCode").orEmpty(),
        createdBy = optString("createdBy").takeUnless { it.isBlank() || it == "null" },
        createdAt = optString("createdAt").orEmpty(),
        memberCount = optInt("memberCount", 0),
        isDefault = optBoolean("isDefault", false)
    )
}

private fun JSONObject.toGroupPresence(): GroupPresence {
    return GroupPresence(
        userId = optString("userId"),
        displayName = optString("displayName").ifBlank { "Friend" },
        active = optBoolean("active", false),
        mode = optString("mode").takeUnless { it.isBlank() || it == "null" },
        startedAt = optString("startedAt").takeUnless { it.isBlank() || it == "null" },
        endsAt = optString("endsAt").takeUnless { it.isBlank() || it == "null" }
    )
}

private fun JSONObject.toLeaderboardEntry(): LeaderboardEntry {
    val focusPoints = when {
        has("focusPoints") -> optInt("focusPoints", 0)
        has("focus_points") -> optInt("focus_points", 0)
        else -> 0
    }
    return LeaderboardEntry(
        rank = optInt("rank", 0),
        userId = optString("userId").orEmpty(),
        displayName = optString("displayName").ifBlank { "User" },
        lockedSeconds = optInt("lockedSeconds", 0),
        focusPoints = focusPoints,
        isCurrentUser = optBoolean("isCurrentUser", false)
    )
}

private fun JSONArray.toStringList(): List<String> {
    return List(length()) { index -> getString(index) }
}

private fun <T> JSONArray.toObjectList(transform: JSONObject.() -> T): List<T> {
    return List(length()) { index -> getJSONObject(index).transform() }
}
