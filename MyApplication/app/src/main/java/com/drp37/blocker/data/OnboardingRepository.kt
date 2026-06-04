package com.drp37.blocker.data

import com.drp37.blocker.model.OnboardingIdRow
import com.drp37.blocker.model.OnboardingResponses
import com.drp37.blocker.model.OnboardingUpsert
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns

object OnboardingRepository {
    suspend fun hasCompleted(userId: String): Boolean {
        val rows = SupabaseAuthClient.client
            .from("onboarding")
            .select(Columns.list("id")) {
                filter {
                    eq("user_id", userId)
                }
            }
            .decodeList<OnboardingIdRow>()
        return rows.isNotEmpty()
    }

    suspend fun save(userId: String, responses: OnboardingResponses) {
        val payload = OnboardingUpsert(
            userId = userId,
            doMoreOf = responses.doMoreOf,
            scrollingWorst = responses.scrollingWorst,
            futureMessage = responses.futureMessage.trim(),
            strictness = responses.strictness,
        )
        SupabaseAuthClient.client.from("onboarding").upsert(payload) {
            onConflict = "user_id"
        }
    }
}
