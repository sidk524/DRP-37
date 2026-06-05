package com.drp37.blocker

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.lifecycleScope
import com.drp37.blocker.data.FrictionIntentContract
import com.drp37.blocker.data.OnboardingRepository
import com.drp37.blocker.data.OnboardingSettings
import com.drp37.blocker.data.SupabaseAuthClient
import com.drp37.blocker.data.allowBlockedPackageTemporarily
import com.drp37.blocker.ui.screens.BlockerSetupScreen
import com.drp37.blocker.ui.screens.FrictionScreen
import com.drp37.blocker.ui.screens.LoginScreen
import com.drp37.blocker.ui.theme.MyApplicationTheme
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.handleDeeplinks
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private var frictionIntentHandler: ((String) -> Unit)? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleAuthDeepLink(intent)
        val initialFrictionPackage = frictionPackageFromIntent(intent)

        setContent {
            MyApplicationTheme {
                var isAuthenticated by remember { mutableStateOf(false) }
                var isLoading by remember { mutableStateOf(false) }
                var errorMessage by remember { mutableStateOf<String?>(null) }
                var pendingFrictionPackage by remember { mutableStateOf(initialFrictionPackage) }
                var onboardingSettings by remember { mutableStateOf<OnboardingSettings?>(null) }
                var isLoadingOnboarding by remember { mutableStateOf(false) }

                frictionIntentHandler = { packageName ->
                    pendingFrictionPackage = packageName
                }

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

                LaunchedEffect(isAuthenticated, pendingFrictionPackage) {
                    val packageName = pendingFrictionPackage
                    if (isAuthenticated && packageName != null) {
                        isLoadingOnboarding = true
                        onboardingSettings = runCatching { OnboardingRepository.loadSettings() }
                            .getOrElse { error ->
                                errorMessage = error.message ?: "Could not load friction settings."
                                null
                            }
                        isLoadingOnboarding = false
                    }
                }

                if (isAuthenticated) {
                    val packageName = pendingFrictionPackage
                    if (packageName != null) {
                        if (isLoadingOnboarding) {
                            LoadingScreen("Loading friction...")
                        } else {
                            FrictionScreen(
                                blockedPackage = packageName,
                                settings = onboardingSettings,
                                onContinue = {
                                    allowBlockedPackageTemporarily(this, packageName)
                                    if (!launchPackage(packageName)) {
                                        errorMessage = "Could not reopen that app."
                                    }
                                    pendingFrictionPackage = null
                                },
                                onCancel = {
                                    pendingFrictionPackage = null
                                }
                            )
                        }
                    } else {
                        BlockerSetupScreen(
                            onLogout = {
                                lifecycleScope.launch {
                                    runCatching {
                                        SupabaseAuthClient.signOut()
                                    }.onSuccess {
                                        isAuthenticated = false
                                        isLoading = false
                                        errorMessage = null
                                    }.onFailure { error ->
                                        errorMessage = error.message ?: "Logout failed."
                                    }
                                }
                            }
                        )
                    }
                } else {
                    LoginScreen(
                        isLoading = isLoading,
                        errorMessage = errorMessage,
                        onEmailLogin = { email, password ->
                            if (!SupabaseAuthClient.isConfigured) {
                                errorMessage = "Add Supabase URL and publishable key first."
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
                                errorMessage = "Add Supabase URL and publishable key first."
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
        frictionPackageFromIntent(intent)?.let { packageName ->
            frictionIntentHandler?.invoke(packageName)
        }
    }

    override fun onDestroy() {
        frictionIntentHandler = null
        super.onDestroy()
    }

    private fun handleAuthDeepLink(intent: Intent?) {
        if (intent == null || !SupabaseAuthClient.isConfigured) return
        lifecycleScope.launch {
            SupabaseAuthClient.client.handleDeeplinks(intent)
        }
    }

    private fun frictionPackageFromIntent(intent: Intent?): String? {
        if (intent?.action != FrictionIntentContract.ACTION_SHOW_FRICTION) return null
        return intent.getStringExtra(FrictionIntentContract.EXTRA_BLOCKED_PACKAGE)
            ?.takeIf { it.isNotBlank() }
    }

    private fun launchPackage(packageName: String): Boolean {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName) ?: return false
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(launchIntent)
        return true
    }
}

@androidx.compose.runtime.Composable
private fun LoadingScreen(text: String) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Text(text = text, color = Color.White)
    }
}
