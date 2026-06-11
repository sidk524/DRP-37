package com.drp37.blocker.remote.webserver

import com.drp37.blocker.BuildConfig
import com.drp37.blocker.auth.AuthService
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URLEncoder
import java.net.URL
import java.nio.charset.StandardCharsets
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object WebServerService {
    suspend fun getCurrentSession(): BlockSessionRecord? {
        val response = request(method = "GET", path = "/api/session/current")
        val session = response.optJSONObject("session") ?: return null
        return session.toBlockSessionRecord()
    }

    suspend fun createSession(
        blockGroupId: String,
        totalDurationSeconds: Int
    ): BlockSessionRecord {
        val body = JSONObject()
            .put("active", true)
            .put("blockGroupId", blockGroupId)
            .put("totalDurationSeconds", totalDurationSeconds)

        val response = request(method = "PUT", path = "/api/session/current", body = body)
        val session = response.optJSONObject("session")
            ?: throw IOException("Server did not return a block session.")
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

    suspend fun endSession(sessionId: String?) {
        val body = JSONObject().put("active", false)
        if (!sessionId.isNullOrBlank()) {
            body.put("sessionId", sessionId)
        }
        request(method = "PUT", path = "/api/session/current", body = body)
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

    suspend fun saveSessionPoints(
        mode: String,
        actualMs: Long,
        plannedMs: Long,
        blockedAppsCount: Int,
        endedAt: String
    ): FocusPointsRecord {
        val body = JSONObject()
            .put("mode", normalizeMode(mode))
            .put("actualMs", actualMs.coerceAtLeast(0L))
            .put("plannedMs", plannedMs.coerceAtLeast(0L))
            .put("blockedAppsCount", blockedAppsCount.coerceAtLeast(1))
            .put("endedAt", endedAt)

        val response = request(method = "POST", path = "/api/focus-points", body = body)
        val record = response.optJSONObject("record")
            ?: throw IOException("Server did not return focus points.")
        return record.toFocusPointsRecord()
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
        val baseUrl = BuildConfig.WEB_SERVER_URL.trimEnd('/')
        if (baseUrl.isBlank()) throw IOException("WEB_SERVER_URL is not configured.")

        val accessToken = AuthService.currentAccessToken()
            ?: throw IOException("No active Supabase session.")
        val connection = (URL("$baseUrl$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 10_000
            setRequestProperty("Authorization", "Bearer $accessToken")
            setRequestProperty("Accept", "application/json")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }

        try {
            if (body != null) {
                OutputStreamWriter(connection.outputStream).use { writer ->
                    writer.write(body.toString())
                }
            }

            val responseCode = connection.responseCode
            val stream = if (responseCode in 200..299) {
                connection.inputStream
            } else {
                connection.errorStream
            }
            if (stream == null) {
                if (responseCode in 200..299) return@withContext JSONObject()
                throw IOException("Server returned HTTP $responseCode.")
            }

            val responseText = stream.bufferedReader().use { it.readText() }
            if (responseCode in 200..299 && responseText.isBlank()) {
                return@withContext JSONObject()
            }
            if (responseCode !in 200..299) {
                val errorMessage = runCatching {
                    JSONObject(responseText).optString("error")
                }.getOrNull().orEmpty()
                throw IOException(errorMessage.ifBlank { "Server returned HTTP $responseCode." })
            }
            JSONObject(responseText)
        } finally {
            connection.disconnect()
        }
    }
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

private fun JSONObject.toBlockSessionRecord(): BlockSessionRecord {
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
        endedAt = optString("ended_at").takeUnless { it.isBlank() || it == "null" }
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

private fun JSONObject.toFocusPointsRecord(): FocusPointsRecord {
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
        memberCount = optInt("memberCount", 0)
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
