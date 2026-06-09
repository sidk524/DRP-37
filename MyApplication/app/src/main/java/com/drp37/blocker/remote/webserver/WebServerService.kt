package com.drp37.blocker.remote.webserver

import com.drp37.blocker.BuildConfig
import com.drp37.blocker.auth.AuthService
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object WebServerService {
    suspend fun getCurrentSession(): BlockSessionRecord? {
        val response = request(method = "GET", path = "/api/session/current")
        val session = response.optJSONObject("session") ?: return null
        return session.toBlockSessionRecord()
    }

    suspend fun createSession(
        appsBlocked: Set<String>,
        totalDurationSeconds: Int
    ): BlockSessionRecord {
        val body = JSONObject()
            .put("active", true)
            .put("appsBlocked", JSONArray(appsBlocked.sorted()))
            .put("totalDurationSeconds", totalDurationSeconds)

        val response = request(method = "PUT", path = "/api/session/current", body = body)
        val session = response.optJSONObject("session")
            ?: throw IOException("Server did not return a block session.")
        return session.toBlockSessionRecord()
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
            } ?: throw IOException("Server returned HTTP $responseCode.")

            val responseText = stream.bufferedReader().use { it.readText() }
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

private fun JSONObject.toBlockSessionRecord(): BlockSessionRecord {
    return BlockSessionRecord(
        id = getString("id"),
        userId = getString("user_id"),
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

private fun JSONArray.toStringList(): List<String> {
    return List(length()) { index -> getString(index) }
}
