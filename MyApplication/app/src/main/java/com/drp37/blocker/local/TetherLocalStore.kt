package com.drp37.blocker.local

import android.content.Context
import com.drp37.blocker.remote.webserver.BlockSessionRecord
import java.time.Instant
import java.util.UUID

object TetherLocalStore {
    private const val PREFS_NAME = "tether_local"
    private const val KEY_SESSION_ID = "session_id"
    private const val KEY_DEVICE_ID = "device_id"
    private const val KEY_PACKAGES = "packages"
    private const val KEY_STARTED_AT_EPOCH_MILLIS = "started_at_epoch_millis"
    private const val KEY_DURATION_SECONDS = "duration_seconds"
    private const val KEY_MODE = "mode"
    private const val KEY_SHARE_ACTIVITY = "share_activity"
    private const val KEY_RECEIVE_FRIEND_ALERTS = "receive_friend_alerts"
    private const val KEY_MIGRATED = "migrated"
    private const val LEGACY_SESSION_PREFS = "active_block_session"
    private const val LEGACY_ALLOW_PREFS = "blocked_package_allow_windows"
    private const val ALLOW_PREFIX = "allow_"
    private const val DEFAULT_ALLOW_MILLIS = 2_500L

    private lateinit var appContext: Context

    fun init(context: Context) {
        appContext = context.applicationContext
        migrateLegacyPrefsIfNeeded()
    }

    fun setAccountabilityPreferences(shareActivity: Boolean, receiveFriendAlerts: Boolean) {
        appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_SHARE_ACTIVITY, shareActivity)
            .putBoolean(KEY_RECEIVE_FRIEND_ALERTS, receiveFriendAlerts)
            .apply()
    }

    fun sharesAccountabilityActivity(): Boolean =
        appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getBoolean(KEY_SHARE_ACTIVITY, true)

    fun receivesFriendAlerts(): Boolean =
        appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getBoolean(KEY_RECEIVE_FRIEND_ALERTS, true)

    fun getOrCreateDeviceId(): String {
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.getString(KEY_DEVICE_ID, null)?.takeIf { it.isNotBlank() }?.let { return it }
        val deviceId = UUID.randomUUID().toString()
        prefs.edit().putString(KEY_DEVICE_ID, deviceId).apply()
        return deviceId
    }

    fun getActiveSession(): ActiveBlockSession? {
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val sessionId = prefs.getString(KEY_SESSION_ID, null)?.takeIf { it.isNotBlank() }
            ?: return null
        val packages = prefs.getString(KEY_PACKAGES, "")
            .orEmpty()
            .split('|')
            .filter { it.isNotBlank() }
            .toSet()
        val startedAtEpochMillis = prefs.getLong(KEY_STARTED_AT_EPOCH_MILLIS, 0L)
        val durationSeconds = prefs.getInt(KEY_DURATION_SECONDS, 0)
        val mode = prefs.getString(KEY_MODE, "reflect").orEmpty().ifBlank { "reflect" }

        val session = ActiveBlockSession(
            sessionId = sessionId,
            packages = packages,
            startedAtEpochMillis = startedAtEpochMillis,
            durationSeconds = durationSeconds,
            mode = mode
        )

        if (!session.isActive()) {
            clearActiveSession()
            return null
        }

        return session
    }

    fun setActiveSession(record: BlockSessionRecord, mode: String = "reflect") {
        appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_SESSION_ID, record.id)
            .putString(KEY_PACKAGES, record.appsBlocked.sorted().joinToString("|"))
            .putLong(KEY_STARTED_AT_EPOCH_MILLIS, Instant.parse(record.startedAt).toEpochMilli())
            .putInt(KEY_DURATION_SECONDS, record.totalDurationSeconds)
            .putString(KEY_MODE, normalizeMode(mode))
            .apply()
    }

    fun updateActiveSessionMode(mode: String) {
        appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_MODE, normalizeMode(mode))
            .apply()
    }

    fun clearActiveSession() {
        appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_SESSION_ID)
            .remove(KEY_PACKAGES)
            .remove(KEY_STARTED_AT_EPOCH_MILLIS)
            .remove(KEY_DURATION_SECONDS)
            .remove(KEY_MODE)
            .apply()
    }

    fun grantTemporaryAllow(packageName: String, durationMillis: Long = DEFAULT_ALLOW_MILLIS) {
        appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putLong(allowKey(packageName), System.currentTimeMillis() + durationMillis)
            .apply()
    }

    fun isTemporarilyAllowed(
        packageName: String,
        nowEpochMillis: Long = System.currentTimeMillis()
    ): Boolean {
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val allowedUntil = prefs.getLong(allowKey(packageName), 0L)
        if (allowedUntil <= 0L) return false
        if (allowedUntil <= nowEpochMillis) {
            prefs.edit().remove(allowKey(packageName)).apply()
            return false
        }
        return true
    }

    private fun allowKey(packageName: String): String = "$ALLOW_PREFIX$packageName"

    private fun normalizeMode(mode: String): String {
        return when (mode) {
            "breathing" -> "breathing"
            "hard" -> "hard"
            else -> "reflect"
        }
    }

    private fun migrateLegacyPrefsIfNeeded() {
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (prefs.getBoolean(KEY_MIGRATED, false)) return

        val legacySession = appContext.getSharedPreferences(LEGACY_SESSION_PREFS, Context.MODE_PRIVATE)
        val sessionId = legacySession.getString(KEY_SESSION_ID, null)?.takeIf { it.isNotBlank() }
        if (sessionId != null && prefs.getString(KEY_SESSION_ID, null).isNullOrBlank()) {
            prefs.edit()
                .putString(KEY_SESSION_ID, sessionId)
                .putString(KEY_PACKAGES, legacySession.getString(KEY_PACKAGES, "").orEmpty())
                .putLong(KEY_STARTED_AT_EPOCH_MILLIS, legacySession.getLong(KEY_STARTED_AT_EPOCH_MILLIS, 0L))
                .putInt(KEY_DURATION_SECONDS, legacySession.getInt(KEY_DURATION_SECONDS, 0))
                .apply()
        }

        prefs.edit().putBoolean(KEY_MIGRATED, true).apply()
        legacySession.edit().clear().apply()
        appContext.getSharedPreferences(LEGACY_ALLOW_PREFS, Context.MODE_PRIVATE).edit().clear().apply()
        appContext.getSharedPreferences("tether_prefs", Context.MODE_PRIVATE).edit().clear().apply()
    }
}
