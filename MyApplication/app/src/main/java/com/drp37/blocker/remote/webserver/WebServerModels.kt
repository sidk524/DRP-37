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
