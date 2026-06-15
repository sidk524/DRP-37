package com.drp37.blocker

import android.content.Intent
import android.os.Bundle
import android.os.Build
import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 37)
        }
        pendingFrictionPackage = frictionPackageFromIntent(intent)
        handleAuthDeepLink(intent)

        setContent {
            MyApplicationTheme {
                AuthGate(
                    pendingFrictionPackage = pendingFrictionPackage,
                    onClearFriction = { pendingFrictionPackage = null }
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
