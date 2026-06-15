package com.drp37.blocker.remote.webserver

data class BlockSessionRecord(
    val id: String,
    val userId: String,
    val blockGroupId: String? = null,
    val canonicalTargets: List<String>,
    val appsBlocked: List<String>,
    val domainsBlocked: List<String>,
    val processTokens: List<String>,
    val totalDurationSeconds: Int,
    val startedAt: String,
    val endedAt: String? = null,
    val mode: String = "reflect"
)

data class BlockGroup(
    val id: String,
    val name: String,
    val systemKey: String? = null,
    val targets: List<String> = emptyList(),
    val appsBlocked: List<String> = emptyList(),
    val domainsBlocked: List<String> = emptyList(),
    val canonicalTargets: List<String> = emptyList(),
    val expandedAppsBlocked: List<String> = emptyList(),
    val expandedDomainsBlocked: List<String> = emptyList(),
    val processTokens: List<String> = emptyList()
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
    val memberCount: Int,
    val isDefault: Boolean = false
)

data class AccountabilityPreferences(
    val shareActivity: Boolean = true,
    val receiveFriendAlerts: Boolean = true
)

data class GroupPresence(
    val userId: String,
    val displayName: String,
    val active: Boolean,
    val mode: String?,
    val startedAt: String?,
    val endsAt: String?
)

data class AccountabilityInboxItem(
    val id: String,
    val kind: String,
    val attemptId: String,
    val title: String,
    val detail: String,
    val unread: Boolean,
    val senderDisplayName: String? = null,
    val actorDisplayName: String? = null,
    val targetLabel: String? = null
)

data class LeaderboardEntry(
    val rank: Int,
    val userId: String,
    val displayName: String,
    val lockedSeconds: Int,
    val focusPoints: Int = 0,
    val isCurrentUser: Boolean
)

data class GroupLeaderboard(
    val entries: List<LeaderboardEntry>,
    val focusPointsAvailable: Boolean = true
)

fun strictnessToMode(strictness: String): String {
    return when (strictness) {
        "gentle" -> "breathing"
        "hard" -> "hard"
        else -> "reflect"
    }
}
