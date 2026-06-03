package com.drp37.blocker.data

import com.drp37.blocker.BuildConfig
import io.github.jan.supabase.auth.auth
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class BlockSessionRecord(
    val id: String,
    val userId: String,
    val appsBlocked: List<String>,
    val totalDurationSeconds: Int,
    val startedAt: String,
    val endedAt: String? = null
)

object BlockSessionRepository {
    suspend fun loadActiveSession(): BlockSessionRecord? {
        val response = request(
            method = "GET",
            path = "/api/session/current"
        )

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

        val response = request(
            method = "PUT",
            path = "/api/session/current",
            body = body
        )

        val session = response.optJSONObject("session")
            ?: throw IOException("Server did not return a block session.")
        return session.toBlockSessionRecord()
    }

    suspend fun endSession(sessionId: String?) {
        val body = JSONObject()
            .put("active", false)

        if (!sessionId.isNullOrBlank()) {
            body.put("sessionId", sessionId)
        }

        request(
            method = "PUT",
            path = "/api/session/current",
            body = body
        )
    }

    private suspend fun request(
        method: String,
        path: String,
        body: JSONObject? = null
    ): JSONObject = withContext(Dispatchers.IO) {
        val baseUrl = BuildConfig.WEB_SERVER_URL.trimEnd('/')
        if (baseUrl.isBlank()) throw IOException("WEB_SERVER_URL is not configured.")

        val accessToken = SupabaseAuthClient.client.auth.currentAccessTokenOrNull()
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

private fun JSONObject.toBlockSessionRecord(): BlockSessionRecord {
    return BlockSessionRecord(
        id = getString("id"),
        userId = getString("user_id"),
        appsBlocked = getJSONArray("apps_blocked").toStringList(),
        totalDurationSeconds = getInt("total_duration_seconds"),
        startedAt = getString("started_at"),
        endedAt = optString("ended_at").takeUnless { it.isBlank() || it == "null" }
    )
}

private fun JSONArray.toStringList(): List<String> {
    return List(length()) { index -> getString(index) }
}
