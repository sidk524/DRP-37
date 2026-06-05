package com.drp37.blocker.data

import android.content.Context

private const val PREFS_NAME = "blocked_package_allow_windows"
private const val DEFAULT_ALLOW_MILLIS = 2_500L

fun allowBlockedPackageTemporarily(
    context: Context,
    packageName: String,
    durationMillis: Long = DEFAULT_ALLOW_MILLIS
) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putLong(packageName, System.currentTimeMillis() + durationMillis)
        .apply()
}

fun isBlockedPackageTemporarilyAllowed(
    context: Context,
    packageName: String,
    nowEpochMillis: Long = System.currentTimeMillis()
): Boolean {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val allowedUntil = prefs.getLong(packageName, 0L)
    if (allowedUntil <= 0L) return false
    if (allowedUntil <= nowEpochMillis) {
        prefs.edit().remove(packageName).apply()
        return false
    }
    return true
}
