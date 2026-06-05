package com.drp37.blocker.ui.screens

import android.content.Context
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drp37.blocker.data.OnboardingSettings
import kotlinx.coroutines.delay

private enum class FrictionPhase {
    Breathing,
    Intention,
    Message,
    Goal
}

@Composable
fun FrictionScreen(
    blockedPackage: String,
    settings: OnboardingSettings?,
    onContinue: () -> Unit,
    onCancel: () -> Unit
) {
    val appName = rememberAppLabel(blockedPackage)
    val firm = settings?.strictness == "moderate" &&
        settings.futureMessage.isNotBlank() &&
        settings.goals.isNotEmpty()
    var phase by remember(blockedPackage, settings) { mutableStateOf(FrictionPhase.Breathing) }
    var readyVisible by remember(blockedPackage, settings) { mutableStateOf(false) }

    LaunchedEffect(blockedPackage, settings) {
        readyVisible = false
        delay(8_000)
        readyVisible = true
        delay(16_000)
        if (phase == FrictionPhase.Breathing) {
            phase = if (firm) FrictionPhase.Message else FrictionPhase.Intention
        }
    }

    Surface(modifier = Modifier.fillMaxSize(), color = Color.Black) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 28.dp),
            contentAlignment = Alignment.Center
        ) {
            when (phase) {
                FrictionPhase.Breathing -> BreathingStep(
                    appName = appName,
                    readyVisible = readyVisible,
                    onReady = {
                        phase = if (firm) FrictionPhase.Message else FrictionPhase.Intention
                    }
                )
                FrictionPhase.Intention -> IntentionStep(
                    appName = appName,
                    onContinue = onContinue,
                    onCancel = onCancel
                )
                FrictionPhase.Message -> MessageStep(
                    appName = appName,
                    message = settings?.futureMessage.orEmpty(),
                    onMatched = { phase = FrictionPhase.Goal },
                    onCancel = onCancel
                )
                FrictionPhase.Goal -> GoalStep(
                    appName = appName,
                    goals = settings?.goals.orEmpty(),
                    onContinue = onContinue,
                    onCancel = onCancel
                )
            }
        }
    }
}

@Composable
private fun BreathingStep(
    appName: String,
    readyVisible: Boolean,
    onReady: () -> Unit
) {
    val transition = rememberInfiniteTransition(label = "breathing")
    val scale by transition.animateFloat(
        initialValue = 0.58f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 4_000),
            repeatMode = RepeatMode.Reverse
        ),
        label = "breathingScale"
    )

    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = "You're about to open $appName",
            color = Color(0xFF8A8A93),
            fontSize = 18.sp,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(28.dp))
        Box(
            modifier = Modifier
                .size(260.dp)
                .scale(scale)
                .clip(CircleShape)
                .background(Color(0x334A9EFF)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = if (scale < 0.79f) "Breathe in" else "Breathe out",
                color = Color.White,
                fontSize = 20.sp,
                fontWeight = FontWeight.Medium
            )
        }
        Spacer(modifier = Modifier.height(28.dp))
        Text(
            text = "Take a breath before you scroll.",
            color = Color(0xFF8A8A93),
            fontSize = 16.sp,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(18.dp))
        if (readyVisible) {
            TextButton(onClick = onReady) {
                Text(text = "I'm ready ->", color = Color(0xFF8A8A93))
            }
        }
    }
}

@Composable
private fun IntentionStep(
    appName: String,
    onContinue: () -> Unit,
    onCancel: () -> Unit
) {
    FrictionColumn {
        Text(
            text = "Why are you opening $appName?",
            color = Color.White,
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(18.dp))
        listOf("Check a message", "Post something", "Just looking").forEach { reason ->
            SecondaryButton(text = reason, onClick = onContinue)
            Spacer(modifier = Modifier.height(10.dp))
        }
        PrimaryButton(text = "Continue to $appName", onClick = onContinue)
        TextButton(onClick = onCancel) {
            Text(text = "Actually, not now", color = Color(0xFF8A8A93))
        }
    }
}

@Composable
private fun MessageStep(
    appName: String,
    message: String,
    onMatched: () -> Unit,
    onCancel: () -> Unit
) {
    var typed by remember(message) { mutableStateOf("") }
    val matches = normalizeTypedText(typed) == normalizeTypedText(message)

    FrictionColumn {
        Text(
            text = "Type your message to yourself",
            color = Color.White,
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = "Before opening $appName, type the message you wrote during onboarding.",
            color = Color(0xFF8A8A93),
            fontSize = 16.sp,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(18.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(Color(0x1A4A9EFF))
                .padding(16.dp)
        ) {
            Text(
                text = message,
                color = Color.White,
                fontSize = 16.sp,
                lineHeight = 23.sp,
                fontStyle = FontStyle.Italic
            )
        }
        Spacer(modifier = Modifier.height(14.dp))
        OutlinedTextField(
            value = typed,
            onValueChange = { typed = it },
            modifier = Modifier.fillMaxWidth(),
            minLines = 4,
            label = { Text(text = "Type your message") }
        )
        Spacer(modifier = Modifier.height(10.dp))
        Text(
            text = if (matches) "Matched." else "Match the message exactly to continue.",
            color = Color(0xFF8A8A93),
            fontSize = 14.sp,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(8.dp))
        PrimaryButton(text = "Next", enabled = matches, onClick = onMatched)
        TextButton(onClick = onCancel) {
            Text(text = "Actually, not now", color = Color(0xFF8A8A93))
        }
    }
}

@Composable
private fun GoalStep(
    appName: String,
    goals: List<String>,
    onContinue: () -> Unit,
    onCancel: () -> Unit
) {
    FrictionColumn {
        Text(
            text = if (goals.size == 1) "Remember your goal" else "Remember your goals",
            color = Color.White,
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = "You said you wanted more of this:",
            color = Color(0xFF8A8A93),
            fontSize = 16.sp,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(18.dp))
        goals.forEach { goal ->
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color(0x1A4A9EFF))
                    .padding(16.dp)
            ) {
                Text(
                    text = goal,
                    color = Color.White,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
            Spacer(modifier = Modifier.height(10.dp))
        }
        PrimaryButton(text = "Continue to $appName", onClick = onContinue)
        TextButton(onClick = onCancel) {
            Text(text = "You're right, close it", color = Color(0xFF8A8A93))
        }
    }
}

@Composable
private fun FrictionColumn(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        content = content
    )
}

@Composable
private fun PrimaryButton(
    text: String,
    enabled: Boolean = true,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color(0xFF0A84FF),
            contentColor = Color.White,
            disabledContainerColor = Color(0xFF1F1F22),
            disabledContentColor = Color(0xFF6D6D73)
        ),
        shape = RoundedCornerShape(14.dp)
    ) {
        Text(text = text, fontSize = 16.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun SecondaryButton(text: String, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color(0xFF1C1E24),
            contentColor = Color.White
        ),
        shape = RoundedCornerShape(14.dp)
    ) {
        Text(text = text, fontSize = 16.sp)
    }
}

@Composable
private fun rememberAppLabel(packageName: String): String {
    val context = LocalContext.current
    return remember(packageName) { appLabel(context, packageName) }
}

private fun appLabel(context: Context, packageName: String): String {
    return runCatching {
        val packageManager = context.packageManager
        val appInfo = packageManager.getApplicationInfo(packageName, 0)
        packageManager.getApplicationLabel(appInfo).toString()
    }.getOrDefault(packageName)
}

private fun normalizeTypedText(value: String): String {
    return value.trim().replace(Regex("\\s+"), " ")
}
