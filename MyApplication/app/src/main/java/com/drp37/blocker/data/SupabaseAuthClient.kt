package com.drp37.blocker.data

import com.drp37.blocker.BuildConfig
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.providers.builtin.Email

object SupabaseAuthClient {
    private const val redirectScheme = "drp37"
    private const val redirectHost = "auth-callback"

    val isConfigured: Boolean
        get() = BuildConfig.SUPABASE_URL.isNotBlank() && BuildConfig.SUPABASE_PUBLISHABLE_KEY.isNotBlank()

    val client by lazy {
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
}
