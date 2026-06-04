package com.drp37.blocker.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class OnboardingIdRow(val id: String)

@Serializable
data class OnboardingUpsert(
    @SerialName("user_id") val userId: String,
    @SerialName("do_more_of") val doMoreOf: List<String>,
    @SerialName("scrolling_worst") val scrollingWorst: List<String>,
    @SerialName("future_message") val futureMessage: String,
    val strictness: String,
)

data class OnboardingResponses(
    val doMoreOf: List<String>,
    val scrollingWorst: List<String>,
    val futureMessage: String,
    val strictness: String,
)

data class OnboardingChoiceOption(
    val label: String,
    val icon: String,
)
