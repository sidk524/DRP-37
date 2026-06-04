package com.drp37.blocker

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.lifecycleScope
import com.drp37.blocker.data.loadBlockList
import com.drp37.blocker.data.loadLaunchableApps
import com.drp37.blocker.data.OnboardingRepository
import com.drp37.blocker.data.saveBlockList
import com.drp37.blocker.data.SupabaseAuthClient
import com.drp37.blocker.ui.components.LockSessionDialog
import com.drp37.blocker.ui.screens.BlockAppsScreen
import com.drp37.blocker.ui.screens.LoginScreen
import com.drp37.blocker.ui.screens.OnboardingScreen
import com.drp37.blocker.ui.screens.SessionStartScreen
import com.drp37.blocker.ui.theme.MyApplicationTheme
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.handleDeeplinks
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.launch

private enum class HomeRoute {
    SessionStart,
    BlockApps,
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleAuthDeepLink(intent)

        setContent {
            MyApplicationTheme {
                val context = LocalContext.current
                var sessionStatus by remember { mutableStateOf<SessionStatus>(SessionStatus.Initializing) }
                var onboardingComplete by remember { mutableStateOf<Boolean?>(null) }
                var isLoading by remember { mutableStateOf(false) }
                var isSavingOnboarding by remember { mutableStateOf(false) }
                var errorMessage by remember { mutableStateOf<String?>(null) }
                var homeRoute by remember { mutableStateOf(HomeRoute.SessionStart) }
                var blockList by remember { mutableStateOf(loadBlockList(context)) }
                var lockSessionActive by remember { mutableStateOf(false) }
                val selectedPackages = remember { mutableStateMapOf<String, Boolean>() }

                LaunchedEffect(Unit) {
                    if (!SupabaseAuthClient.isConfigured) {
                        sessionStatus = SessionStatus.NotAuthenticated()
                        return@LaunchedEffect
                    }
                    SupabaseAuthClient.client.auth.sessionStatus.collect { status ->
                        sessionStatus = status
                        if (status is SessionStatus.Authenticated) {
                            isLoading = false
                            errorMessage = null
                        } else if (status is SessionStatus.NotAuthenticated) {
                            isLoading = false
                            onboardingComplete = null
                            homeRoute = HomeRoute.SessionStart
                            lockSessionActive = false
                        }
                    }
                }

                LaunchedEffect(sessionStatus) {
                    val authenticated = sessionStatus as? SessionStatus.Authenticated
                    if (authenticated == null || !SupabaseAuthClient.isConfigured) {
                        onboardingComplete = null
                        return@LaunchedEffect
                    }

                    onboardingComplete = null
                    val userId = authenticated.session.user?.id
                    if (userId == null) {
                        onboardingComplete = false
                        return@LaunchedEffect
                    }

                    val completed = runCatching {
                        OnboardingRepository.hasCompleted(userId)
                    }.getOrElse { false }
                    onboardingComplete = completed
                    if (completed) {
                        homeRoute = HomeRoute.SessionStart
                    }
                }

                when {
                    !SupabaseAuthClient.isConfigured -> {
                        LoginScreen(
                            isLoading = isLoading,
                            errorMessage = errorMessage ?: "Supabase is not configured.",
                            onEmailLogin = { email, password ->
                                handleEmailLogin(
                                    email = email,
                                    password = password,
                                    onLoading = { isLoading = it },
                                    onError = { errorMessage = it },
                                )
                            },
                            onGoogleLogin = {
                                handleGoogleLogin(
                                    onLoading = { isLoading = it },
                                    onError = { errorMessage = it },
                                )
                            },
                        )
                    }

                    sessionStatus is SessionStatus.Initializing ||
                        sessionStatus is SessionStatus.RefreshFailure -> {
                        AuthLoadingScreen()
                    }

                    sessionStatus is SessionStatus.NotAuthenticated -> {
                        LoginScreen(
                            isLoading = isLoading,
                            errorMessage = errorMessage,
                            onEmailLogin = { email, password ->
                                handleEmailLogin(
                                    email = email,
                                    password = password,
                                    onLoading = { isLoading = it },
                                    onError = { errorMessage = it },
                                )
                            },
                            onGoogleLogin = {
                                handleGoogleLogin(
                                    onLoading = { isLoading = it },
                                    onError = { errorMessage = it },
                                )
                            },
                        )
                    }

                    onboardingComplete == null -> {
                        AuthLoadingScreen()
                    }

                    onboardingComplete == false -> {
                        OnboardingScreen(
                            isSaving = isSavingOnboarding,
                            errorMessage = errorMessage,
                            onComplete = { responses ->
                                val userId =
                                    (sessionStatus as? SessionStatus.Authenticated)?.session?.user?.id
                                if (userId == null) {
                                    errorMessage = "Not signed in."
                                    return@OnboardingScreen
                                }

                                isSavingOnboarding = true
                                errorMessage = null
                                lifecycleScope.launch {
                                    runCatching {
                                        OnboardingRepository.save(userId, responses)
                                    }.onSuccess {
                                        val mode = when (responses.strictness) {
                                            "gentle" -> "breathing"
                                            "moderate" -> "reflect"
                                            "strict" -> "hard"
                                            else -> "breathing"
                                        }
                                        blockList = blockList.copy(mode = mode)
                                        saveBlockList(context, blockList)
                                        isSavingOnboarding = false
                                        onboardingComplete = true
                                        homeRoute = HomeRoute.SessionStart
                                    }.onFailure { error ->
                                        isSavingOnboarding = false
                                        errorMessage = error.message ?: "Failed to save onboarding."
                                    }
                                }
                            },
                        )
                    }

                    else -> {
                        val accountLabel =
                            (sessionStatus as? SessionStatus.Authenticated)?.session?.user?.email
                                ?: "your account"

                        when (homeRoute) {
                            HomeRoute.SessionStart -> {
                                SessionStartScreen(
                                    blockList = blockList,
                                    accountLabel = accountLabel,
                                    onBlockListChange = { updated ->
                                        blockList = updated
                                        saveBlockList(context, updated)
                                    },
                                    onSelectApps = {
                                        val apps = loadLaunchableApps(context)
                                        selectedPackages.clear()
                                        apps.forEach { app ->
                                            selectedPackages[app.packageName] =
                                                app.packageName in blockList.packages
                                        }
                                        homeRoute = HomeRoute.BlockApps
                                    },
                                    onLockIn = {
                                        saveBlockList(context, blockList)
                                        lockSessionActive = true
                                    },
                                    onSignOut = {
                                        lifecycleScope.launch {
                                            runCatching { SupabaseAuthClient.signOut() }
                                        }
                                    },
                                )
                            }

                            HomeRoute.BlockApps -> {
                                BlockAppsScreen(
                                    selectedPackages = selectedPackages,
                                    onBack = {
                                        val packages = selectedPackages
                                            .filter { it.value }
                                            .keys
                                            .toSet()
                                        blockList = blockList.copy(packages = packages)
                                        saveBlockList(context, blockList)
                                        homeRoute = HomeRoute.SessionStart
                                    },
                                )
                            }
                        }

                        if (lockSessionActive) {
                            LockSessionDialog(
                                durationMinutes = blockList.durationMinutes,
                                onStop = { lockSessionActive = false },
                            )
                        }
                    }
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

    private fun handleEmailLogin(
        email: String,
        password: String,
        onLoading: (Boolean) -> Unit,
        onError: (String?) -> Unit,
    ) {
        if (!SupabaseAuthClient.isConfigured) {
            onError("Add Supabase URL and publishable key first.")
            return
        }

        onLoading(true)
        onError(null)
        lifecycleScope.launch {
            runCatching {
                SupabaseAuthClient.signInWithEmail(email, password)
            }.onFailure { error ->
                onLoading(false)
                onError(error.message ?: "Email login failed.")
            }
        }
    }

    private fun handleGoogleLogin(
        onLoading: (Boolean) -> Unit,
        onError: (String?) -> Unit,
    ) {
        if (!SupabaseAuthClient.isConfigured) {
            onError("Add Supabase URL and publishable key first.")
            return
        }

        onLoading(true)
        onError(null)
        lifecycleScope.launch {
            runCatching {
                SupabaseAuthClient.signInWithGoogle()
            }.onFailure { error ->
                onLoading(false)
                onError(error.message ?: "Google login failed.")
            }
        }
    }
}

@Composable
private fun AuthLoadingScreen() {
    Surface(modifier = Modifier.fillMaxSize(), color = Color.Black) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            CircularProgressIndicator(color = Color(0xFF0A84FF))
        }
    }
}
