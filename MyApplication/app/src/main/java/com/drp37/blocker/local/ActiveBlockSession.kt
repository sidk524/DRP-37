package com.drp37.blocker.local

data class ActiveBlockSession(
    val sessionId: String,
    val packages: Set<String>,
    val startedAtEpochMillis: Long,
    val durationSeconds: Int,
    val mode: String = "reflect"
) {
    fun isActive(nowEpochMillis: Long = System.currentTimeMillis()): Boolean {
        return startedAtEpochMillis + durationSeconds * 1000L > nowEpochMillis
    }
}
