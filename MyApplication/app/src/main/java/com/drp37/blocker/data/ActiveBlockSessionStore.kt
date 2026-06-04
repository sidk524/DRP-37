package com.drp37.blocker.data

import android.content.Context
import java.time.Instant

private const val PREFS_NAME = "active_block_session"
private const val KEY_SESSION_ID = "session_id"
private const val KEY_PACKAGES = "packages"
private const val KEY_STARTED_AT_EPOCH_MILLIS = "started_at_epoch_millis"
private const val KEY_DURATION_SECONDS = "duration_seconds"

data class ActiveBlockSession(
    val sessionId: String,
    val packages: Set<String>,
    val startedAtEpochMillis: Long,
    val durationSeconds: Int
) {
    fun isActive(nowEpochMillis: Long = System.currentTimeMillis()): Boolean {
        return startedAtEpochMillis + durationSeconds * 1000L > nowEpochMillis
    }
}

fun saveActiveBlockSession(context: Context, session: BlockSessionRecord) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY_SESSION_ID, session.id)
        .putString(KEY_PACKAGES, session.appsBlocked.sorted().joinToString("|"))
        .putLong(KEY_STARTED_AT_EPOCH_MILLIS, Instant.parse(session.startedAt).toEpochMilli())
        .putInt(KEY_DURATION_SECONDS, session.totalDurationSeconds)
        .apply()
}

fun loadActiveBlockSession(context: Context): ActiveBlockSession? {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val sessionId = prefs.getString(KEY_SESSION_ID, null)?.takeIf { it.isNotBlank() }
        ?: return null
    val packages = prefs.getString(KEY_PACKAGES, "")
        .orEmpty()
        .split('|')
        .filter { it.isNotBlank() }
        .toSet()
    val startedAtEpochMillis = prefs.getLong(KEY_STARTED_AT_EPOCH_MILLIS, 0L)
    val durationSeconds = prefs.getInt(KEY_DURATION_SECONDS, 0)

    val session = ActiveBlockSession(
        sessionId = sessionId,
        packages = packages,
        startedAtEpochMillis = startedAtEpochMillis,
        durationSeconds = durationSeconds
    )

    if (!session.isActive()) {
        clearActiveBlockSession(context)
        return null
    }

    return session
}

fun clearActiveBlockSession(context: Context) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .clear()
        .apply()
}
