package com.drp37.blocker

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.lifecycleScope
import com.drp37.blocker.data.SupabaseAuthClient
import com.drp37.blocker.ui.screens.BlockerSetupScreen
import com.drp37.blocker.ui.screens.LoginScreen
import com.drp37.blocker.ui.theme.MyApplicationTheme
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.handleDeeplinks
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleAuthDeepLink(intent)

        setContent {
            MyApplicationTheme {
                var isAuthenticated by remember { mutableStateOf(false) }
                var isLoading by remember { mutableStateOf(false) }
                var errorMessage by remember { mutableStateOf<String?>(null) }

                LaunchedEffect(Unit) {
                    if (SupabaseAuthClient.isConfigured) {
                        SupabaseAuthClient.client.auth.sessionStatus.collect { status ->
                            isAuthenticated = status is SessionStatus.Authenticated
                            if (isAuthenticated) {
                                isLoading = false
                                errorMessage = null
                            }
                        }
                    } else {
                        errorMessage = "Supabase is not configured."
                    }
                }

                if (isAuthenticated) {
                    BlockerSetupScreen()
                } else {
                    LoginScreen(
                        isLoading = isLoading,
                        errorMessage = errorMessage,
                        onEmailLogin = { email, password ->
                            if (!SupabaseAuthClient.isConfigured) {
                                errorMessage = "Add Supabase URL and anon key first."
                                return@LoginScreen
                            }

                            isLoading = true
                            errorMessage = null
                            lifecycleScope.launch {
                                runCatching {
                                    SupabaseAuthClient.signInWithEmail(email, password)
                                }.onFailure { error ->
                                    isLoading = false
                                    errorMessage = error.message ?: "Email login failed."
                                }
                            }
                        },
                        onGoogleLogin = {
                            if (!SupabaseAuthClient.isConfigured) {
                                errorMessage = "Add Supabase URL and anon key first."
                                return@LoginScreen
                            }

                            isLoading = true
                            errorMessage = null
                            lifecycleScope.launch {
                                runCatching {
                                    SupabaseAuthClient.signInWithGoogle()
                                }.onFailure { error ->
                                    isLoading = false
                                    errorMessage = error.message ?: "Google login failed."
                                }
                            }
                        }
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleAuthDeepLink(intent)
    }

    private fun handleAuthDeepLink(intent: Intent?) {
        if (intent == null || !SupabaseAuthClient.isConfigured) return
        lifecycleScope.launch {
            SupabaseAuthClient.client.handleDeeplinks(intent)
        }
    }
}
