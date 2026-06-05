package com.drp37.blocker.data

import android.util.Base64
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

data class OnboardingSettings(
    val goals: List<String> = emptyList(),
    val scrollingWorst: List<String> = emptyList(),
    val futureMessage: String = "",
    val strictness: String = "moderate"
)

object OnboardingRepository {
    suspend fun loadSettings(): OnboardingSettings? = withContext(Dispatchers.IO) {
        val baseUrl = BuildConfig.SUPABASE_URL.trimEnd('/')
        val publishableKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY
        if (baseUrl.isBlank() || publishableKey.isBlank()) {
            throw IOException("Supabase is not configured.")
        }

        val accessToken = SupabaseAuthClient.client.auth.currentAccessTokenOrNull()
            ?: throw IOException("No active Supabase session.")

        val url = URL("$baseUrl/rest/v1/onboarding?select=do_more_of,scrolling_worst,future_message,strictness&limit=1")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 10_000
            readTimeout = 10_000
            setRequestProperty("apikey", publishableKey)
            setRequestProperty("Authorization", "Bearer $accessToken")
            setRequestProperty("Accept", "application/json")
        }

        try {
            val responseCode = connection.responseCode
            val stream = if (responseCode in 200..299) {
                connection.inputStream
            } else {
                connection.errorStream
            } ?: throw IOException("Supabase returned HTTP $responseCode.")

            val responseText = stream.bufferedReader().use { it.readText() }
            if (responseCode !in 200..299) {
                throw IOException("Supabase returned HTTP $responseCode.")
            }

            val rows = JSONArray(responseText)
            if (rows.length() == 0) return@withContext null

            val row = rows.getJSONObject(0)
            val strictness = when (row.optString("strictness")) {
                "gentle" -> "gentle"
                "moderate" -> "moderate"
                "hard" -> "hard"
                else -> "moderate"
            }
            OnboardingSettings(
                goals = row.optJSONArray("do_more_of")?.toStringList().orEmpty(),
                scrollingWorst = row.optJSONArray("scrolling_worst")?.toStringList().orEmpty(),
                futureMessage = row.optString("future_message").orEmpty(),
                strictness = strictness
            )
        } finally {
            connection.disconnect()
        }
    }

    suspend fun saveSettings(settings: OnboardingSettings): Unit = withContext(Dispatchers.IO) {
        val baseUrl = BuildConfig.SUPABASE_URL.trimEnd('/')
        val publishableKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY
        if (baseUrl.isBlank() || publishableKey.isBlank()) {
            throw IOException("Supabase is not configured.")
        }

        val accessToken = SupabaseAuthClient.client.auth.currentAccessTokenOrNull()
            ?: throw IOException("No active Supabase session.")
        val userId = userIdFromAccessToken(accessToken)
            ?: throw IOException("Could not identify current user.")

        val body = JSONObject()
            .put("user_id", userId)
            .put("do_more_of", JSONArray(settings.goals))
            .put("scrolling_worst", JSONArray(settings.scrollingWorst))
            .put("future_message", settings.futureMessage.trim())
            .put("strictness", normalizeStrictness(settings.strictness))

        val url = URL("$baseUrl/rest/v1/onboarding?on_conflict=user_id")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            readTimeout = 10_000
            doOutput = true
            setRequestProperty("apikey", publishableKey)
            setRequestProperty("Authorization", "Bearer $accessToken")
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Prefer", "resolution=merge-duplicates,return=minimal")
        }

        try {
            OutputStreamWriter(connection.outputStream).use { writer ->
                writer.write(body.toString())
            }
            val responseCode = connection.responseCode
            if (responseCode !in 200..299) {
                throw IOException("Supabase returned HTTP $responseCode.")
            }
        } finally {
            connection.disconnect()
        }
    }
}

private fun JSONArray.toStringList(): List<String> {
    return List(length()) { index -> optString(index).trim() }
        .filter { it.isNotBlank() }
}

private fun normalizeStrictness(strictness: String): String {
    return when (strictness) {
        "gentle" -> "gentle"
        "moderate" -> "moderate"
        "hard" -> "hard"
        else -> "moderate"
    }
}

private fun userIdFromAccessToken(accessToken: String): String? {
    val payload = accessToken.split('.').getOrNull(1) ?: return null
    val decoded = String(Base64.decode(payload, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING))
    return runCatching { JSONObject(decoded).optString("sub").takeIf { it.isNotBlank() } }.getOrNull()
}
