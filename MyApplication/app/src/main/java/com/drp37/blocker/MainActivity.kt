package com.drp37.blocker

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import com.drp37.blocker.ui.screens.BlockerSetupScreen
import com.drp37.blocker.ui.screens.LoginScreen
import com.drp37.blocker.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MyApplicationTheme {
                val isAuthenticated by remember { mutableStateOf(false) }

                if (isAuthenticated) {
                    BlockerSetupScreen()
                } else {
                    LoginScreen()
                }
            }
        }
    }
}
