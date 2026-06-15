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
import com.drp37.blocker.remote.webserver.SessionSyncClient
import com.drp37.blocker.remote.webserver.WebServerService
import com.drp37.blocker.local.TetherLocalStore
import com.drp37.blocker.ui.screens.BlockerSetupScreen
import com.drp37.blocker.ui.screens.FrictionScreen
import com.drp37.blocker.ui.screens.LoginScreen
import com.drp37.blocker.ui.screens.OnboardingScreen
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.launch

private enum class OnboardingGate {
    Loading,
    Required,
    Complete
}

@Composable
fun AuthGate(
    pendingFrictionPackage: String?,
    onClearFriction: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var authLoading by remember { mutableStateOf(AuthService.isConfigured) }
    var isAuthenticated by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var onboardingSettings by remember { mutableStateOf<OnboardingSettings?>(null) }
    var onboardingGate by remember { mutableStateOf(OnboardingGate.Loading) }
    var syncedDefaultGroups by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        if (AuthService.isConfigured) {
            AuthService.sessionStatus.collect { status ->
                when (status) {
                    is SessionStatus.Authenticated -> {
                        authLoading = false
                        isAuthenticated = true
                        isLoading = false
                        errorMessage = null
                        SessionSyncClient.start()
                    }
                    is SessionStatus.NotAuthenticated -> {
                        authLoading = false
                        isAuthenticated = false
                        isLoading = false
                        onboardingSettings = null
                        onboardingGate = OnboardingGate.Loading
                        syncedDefaultGroups = false
                        SessionSyncClient.stop()
                    }
                    else -> {
                        authLoading = true
                    }
                }
            }
        } else {
            authLoading = false
            errorMessage = "Supabase is not configured."
        }
    }

    LaunchedEffect(isAuthenticated) {
        if (!isAuthenticated) return@LaunchedEffect
        onboardingGate = OnboardingGate.Loading
        runCatching { WebServerService.loadOnboarding() }
            .onSuccess { settings ->
                onboardingSettings = settings
                onboardingGate = if (settings == null) {
                    OnboardingGate.Required
                } else {
                    OnboardingGate.Complete
                }
                settings?.let { loaded ->
                    if (!syncedDefaultGroups) {
                        runCatching { WebServerService.syncDefaultGroups(loaded.scrollingWorst) }
                        syncedDefaultGroups = true
                    }
                }
            }
            .onFailure { error ->
                errorMessage = error.message ?: "Could not load friction settings."
                onboardingGate = OnboardingGate.Complete
            }
    }

    if (authLoading) {
        LoadingScreen("Loading...")
    } else if (isAuthenticated) {
        val packageName = pendingFrictionPackage
        if (packageName != null) {
            if (onboardingGate == OnboardingGate.Loading) {
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
        } else when (onboardingGate) {
            OnboardingGate.Loading -> LoadingScreen("Loading...")
            OnboardingGate.Required -> OnboardingScreen(
                onComplete = { settings ->
                    onboardingSettings = settings
                    onboardingGate = OnboardingGate.Complete
                    syncedDefaultGroups = true
                }
            )
            OnboardingGate.Complete -> BlockerSetupScreen(
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
                            onboardingGate = OnboardingGate.Loading
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
