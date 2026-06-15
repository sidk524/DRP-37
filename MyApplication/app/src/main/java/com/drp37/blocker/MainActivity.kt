package com.drp37.blocker

import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.lifecycleScope
import com.drp37.blocker.auth.AuthService
import com.drp37.blocker.ui.AuthGate
import com.drp37.blocker.ui.frictionPackageFromIntent
import com.drp37.blocker.ui.theme.MyApplicationTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private var pendingFrictionPackage by mutableStateOf<String?>(null)
    private var pendingOpenInbox by mutableStateOf(false)

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
        }
        enableEdgeToEdge()
        pendingFrictionPackage = frictionPackageFromIntent(intent)
        pendingOpenInbox = intent?.getBooleanExtra(com.drp37.blocker.accountability.AccountabilityNotifier.OPEN_INBOX, false) == true
        handleAuthDeepLink(intent)

        setContent {
            MyApplicationTheme {
                AuthGate(
                    pendingFrictionPackage = pendingFrictionPackage,
                    onClearFriction = { pendingFrictionPackage = null },
                    pendingOpenInbox = pendingOpenInbox,
                    onClearOpenInbox = { pendingOpenInbox = false }
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleAuthDeepLink(intent)
        frictionPackageFromIntent(intent)?.let { packageName ->
            pendingFrictionPackage = packageName
        }
        if (intent?.getBooleanExtra(com.drp37.blocker.accountability.AccountabilityNotifier.OPEN_INBOX, false) == true) {
            pendingOpenInbox = true
        }
    }

    override fun onDestroy() {
        super.onDestroy()
    }

    private fun handleAuthDeepLink(intent: Intent?) {
        if (intent == null || !AuthService.isConfigured) return
        lifecycleScope.launch {
            AuthService.handleDeepLink(intent)
        }
    }
}
