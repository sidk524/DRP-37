package com.drp37.blocker.ui

import android.content.Intent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import com.drp37.blocker.auth.AuthService
import com.drp37.blocker.blocking.FrictionIntentContract
import com.drp37.blocker.remote.webserver.OnboardingSettings
import com.drp37.blocker.remote.webserver.WebServerService
import com.drp37.blocker.local.TetherLocalStore
import com.drp37.blocker.ui.screens.BlockerSetupScreen
import com.drp37.blocker.ui.screens.FrictionScreen
import com.drp37.blocker.ui.screens.LoginScreen
import com.drp37.blocker.ui.screens.OnboardingScreen
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.launch

@Composable
fun AuthGate(
    pendingFrictionPackage: String?,
    onClearFriction: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var isAuthenticated by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var onboardingSettings by remember { mutableStateOf<OnboardingSettings?>(null) }
    var isLoadingOnboarding by remember { mutableStateOf(false) }
    var hasLoadedOnboarding by remember { mutableStateOf(false) }
    var syncedDefaultGroups by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        if (AuthService.isConfigured) {
            AuthService.sessionStatus.collect { status ->
                isAuthenticated = status is SessionStatus.Authenticated
                if (isAuthenticated) {
                    isLoading = false
                    errorMessage = null
                } else {
                    onboardingSettings = null
                    hasLoadedOnboarding = false
                    syncedDefaultGroups = false
                }
            }
        } else {
            errorMessage = "Supabase is not configured."
        }
    }

    LaunchedEffect(isAuthenticated) {
        if (isAuthenticated) {
            isLoadingOnboarding = true
            hasLoadedOnboarding = false
            onboardingSettings = runCatching { WebServerService.loadOnboarding() }
                .getOrElse { error ->
                    errorMessage = error.message ?: "Could not load friction settings."
                    null
                }
            hasLoadedOnboarding = true
            isLoadingOnboarding = false
            onboardingSettings?.let { settings ->
                if (!syncedDefaultGroups) {
                    runCatching { WebServerService.syncDefaultGroups(settings.scrollingWorst) }
                    syncedDefaultGroups = true
                }
            }
        }
    }

    if (isAuthenticated) {
        val packageName = pendingFrictionPackage
        if (packageName != null) {
            if (isLoadingOnboarding || !hasLoadedOnboarding) {
                LoadingScreen("Loading friction...")
            } else {
                FrictionScreen(
                    blockedPackage = packageName,
                    settings = onboardingSettings,
                    mode = TetherLocalStore.getActiveSession()?.mode
                        ?: com.drp37.blocker.remote.webserver.strictnessToMode(onboardingSettings?.strictness ?: "moderate"),
                    onContinue = {
                        if (TetherLocalStore.getActiveSession()?.mode == "hard") {
                            onClearFriction()
                        } else {
                            TetherLocalStore.grantTemporaryAllow(packageName)
                            val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName)
                            if (launchIntent != null) {
                                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                context.startActivity(launchIntent)
                            } else {
                                errorMessage = "Could not reopen that app."
                            }
                            onClearFriction()
                        }
                    },
                    onCancel = onClearFriction
                )
            }
        } else if (isLoadingOnboarding || !hasLoadedOnboarding) {
            LoadingScreen("Loading onboarding...")
        } else if (onboardingSettings == null) {
            OnboardingScreen(
                onComplete = { settings ->
                    onboardingSettings = settings
                    syncedDefaultGroups = true
                }
            )
        } else {
            BlockerSetupScreen(
                onboardingSettings = onboardingSettings,
                onLogout = {
                    coroutineScope.launch {
                        runCatching {
                            AuthService.signOut()
                        }.onSuccess {
                            isAuthenticated = false
                            isLoading = false
                            errorMessage = null
                            onboardingSettings = null
                            hasLoadedOnboarding = false
                            syncedDefaultGroups = false
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
                if (!AuthService.isConfigured) {
                    errorMessage = "Add Supabase URL and publishable key first."
                    return@LoginScreen
                }

                isLoading = true
                errorMessage = null
                coroutineScope.launch {
                    runCatching {
                        AuthService.signInWithEmail(email, password)
                    }.onFailure { error ->
                        isLoading = false
                        errorMessage = error.message ?: "Email login failed."
                    }
                }
            },
            onEmailSignUp = { email, password ->
                if (!AuthService.isConfigured) {
                    errorMessage = "Add Supabase URL and publishable key first."
                    return@LoginScreen
                }

                isLoading = true
                errorMessage = null
                coroutineScope.launch {
                    runCatching {
                        AuthService.signUpWithEmail(email, password)
                    }.onSuccess {
                        isLoading = false
                        if (AuthService.currentAccessToken().isNullOrBlank()) {
                            errorMessage = "Check your email to finish signing up."
                        }
                    }.onFailure { error ->
                        isLoading = false
                        errorMessage = error.message ?: "Email sign-up failed."
                    }
                }
            },
            onGoogleLogin = {
                if (!AuthService.isConfigured) {
                    errorMessage = "Add Supabase URL and publishable key first."
                    return@LoginScreen
                }

                isLoading = true
                errorMessage = null
                coroutineScope.launch {
                    runCatching {
                        AuthService.signInWithGoogle()
                    }.onFailure { error ->
                        isLoading = false
                        errorMessage = error.message ?: "Google login failed."
                    }
                }
            }
        )
    }
}

@Composable
private fun LoadingScreen(text: String) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Text(text = text, color = Color.White)
    }
}

fun frictionPackageFromIntent(intent: Intent?): String? {
    if (intent?.action != FrictionIntentContract.ACTION_SHOW_FRICTION) return null
    return intent.getStringExtra(FrictionIntentContract.EXTRA_BLOCKED_PACKAGE)
        ?.takeIf { it.isNotBlank() }
}
