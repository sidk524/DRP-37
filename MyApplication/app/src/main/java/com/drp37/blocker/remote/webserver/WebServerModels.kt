package com.drp37.blocker.remote.webserver

data class BlockSessionRecord(
    val id: String,
    val userId: String,
    val canonicalTargets: List<String>,
    val appsBlocked: List<String>,
    val domainsBlocked: List<String>,
    val processTokens: List<String>,
    val totalDurationSeconds: Int,
    val startedAt: String,
    val endedAt: String? = null
)

data class OnboardingSettings(
    val goals: List<String> = emptyList(),
    val scrollingWorst: List<String> = emptyList(),
    val futureMessage: String = "",
    val strictness: String = "moderate"
)

data class FocusPointsRecord(
    val id: String,
    val userId: String,
    val mode: String,
    val actualMs: Long,
    val plannedMs: Long,
    val blockedAppsCount: Int,
    val points: Int,
    val endedAt: String,
    val createdAt: String
)

data class GroupSummary(
    val id: String,
    val name: String,
    val inviteCode: String,
    val createdBy: String?,
    val createdAt: String,
    val memberCount: Int
)

data class LeaderboardEntry(
    val rank: Int,
    val userId: String,
    val displayName: String,
    val lockedSeconds: Int,
    val isCurrentUser: Boolean
)

fun strictnessToMode(strictness: String): String {
    return when (strictness) {
        "gentle" -> "breathing"
        "hard" -> "hard"
        else -> "reflect"
    }
}
