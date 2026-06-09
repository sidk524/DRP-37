package com.drp37.blocker.auth

import android.content.Intent
import com.drp37.blocker.BuildConfig
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.handleDeeplinks
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.createSupabaseClient
import kotlinx.coroutines.flow.Flow

object AuthService {
    private const val redirectScheme = "drp37"
    private const val redirectHost = "auth-callback"

    val isConfigured: Boolean
        get() = BuildConfig.SUPABASE_URL.isNotBlank() && BuildConfig.SUPABASE_PUBLISHABLE_KEY.isNotBlank()

    private val client by lazy {
        check(isConfigured) {
            "Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to MyApplication/local.properties"
        }

        createSupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY
        ) {
            install(Auth) {
                scheme = redirectScheme
                host = redirectHost
            }
        }
    }

    val sessionStatus: Flow<SessionStatus>
        get() = client.auth.sessionStatus

    fun currentAccessToken(): String? = client.auth.currentAccessTokenOrNull()

    suspend fun signInWithEmail(email: String, password: String) {
        client.auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
    }

    suspend fun signInWithGoogle() {
        client.auth.signInWith(Google)
    }

    suspend fun signOut() {
        client.auth.signOut()
    }

    suspend fun handleDeepLink(intent: Intent?) {
        if (intent == null || !isConfigured) return
        client.handleDeeplinks(intent)
    }
}
