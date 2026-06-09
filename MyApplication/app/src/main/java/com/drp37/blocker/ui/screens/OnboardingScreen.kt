package com.drp37.blocker.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drp37.blocker.remote.webserver.OnboardingSettings
import com.drp37.blocker.remote.webserver.WebServerService
import kotlinx.coroutines.launch

private val onboardingGoalOptions = listOf("Read more", "Exercise", "Call family", "Creative work")
private val onboardingWorstTimeOptions = listOf("Late night", "First thing morning", "Meals", "Work hours")
private val onboardingStrictnessOptions = listOf(
    OnboardingStrictnessOption("gentle", "Gentle nudges", "A breathing pause before you can continue."),
    OnboardingStrictnessOption("moderate", "Firm friction", "A message and goal reminder before you continue."),
    OnboardingStrictnessOption("hard", "Hard block", "No bypass until your focus session ends.")
)

@Composable
fun OnboardingScreen(onComplete: (OnboardingSettings) -> Unit) {
    val coroutineScope = rememberCoroutineScope()
    var step by remember { mutableIntStateOf(0) }
    var settings by remember { mutableStateOf(OnboardingSettings(strictness = "moderate")) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val canContinue = when (step) {
        0 -> settings.goals.isNotEmpty()
        1 -> settings.scrollingWorst.isNotEmpty()
        2 -> settings.futureMessage.trim().isNotEmpty()
        else -> settings.strictness.isNotBlank()
    }

    fun toggleGoal(value: String) {
        settings = settings.copy(
            goals = if (value in settings.goals) {
                settings.goals.filterNot { it == value }
            } else {
                settings.goals + value
            }
        )
    }

    fun toggleWorstTime(value: String) {
        settings = settings.copy(
            scrollingWorst = if (value in settings.scrollingWorst) {
                settings.scrollingWorst.filterNot { it == value }
            } else {
                settings.scrollingWorst + value
            }
        )
    }

    Surface(modifier = Modifier.fillMaxSize(), color = Color.Black) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp, vertical = 28.dp),
            horizontalAlignment = Alignment.Start
        ) {
            Text(
                text = "Step ${step + 1} of 4",
                color = Color(0xFF8E8E96),
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = when (step) {
                    0 -> "What do you want more of?"
                    1 -> "When is scrolling worst?"
                    2 -> "Write a note to yourself"
                    else -> "Choose your strictness"
                },
                color = Color.White,
                fontSize = 32.sp,
                lineHeight = 38.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = when (step) {
                    0 -> "Tether uses this during friction moments."
                    1 -> "These also keep your default leaderboards in sync."
                    2 -> "You may need to type this before opening a blocked app."
                    else -> "Hard sessions cannot be ended early."
                },
                color = Color(0xFF8E8E96),
                fontSize = 16.sp,
                lineHeight = 22.sp,
                modifier = Modifier.padding(top = 8.dp)
            )
            Spacer(modifier = Modifier.height(22.dp))
            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                when (step) {
                    0 -> onboardingGoalOptions.forEach { option ->
                        OnboardingChoiceRow(
                            label = option,
                            selected = option in settings.goals,
                            onClick = { toggleGoal(option) }
                        )
                    }
                    1 -> onboardingWorstTimeOptions.forEach { option ->
                        OnboardingChoiceRow(
                            label = option,
                            selected = option in settings.scrollingWorst,
                            onClick = { toggleWorstTime(option) }
                        )
                    }
                    2 -> OutlinedTextField(
                        value = settings.futureMessage,
                        onValueChange = { settings = settings.copy(futureMessage = it) },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 6,
                        label = { Text(text = "Message") },
                        placeholder = { Text(text = "Put the phone down. You'll feel better.") }
                    )
                    else -> onboardingStrictnessOptions.forEach { option ->
                        OnboardingStrictnessRow(
                            option = option,
                            selected = settings.strictness == option.value,
                            onClick = { settings = settings.copy(strictness = option.value) }
                        )
                    }
                }
            }
            if (!error.isNullOrBlank()) {
                Text(
                    text = error.orEmpty(),
                    color = Color(0xFFFF453A),
                    fontSize = 14.sp,
                    modifier = Modifier.padding(top = 12.dp)
                )
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (step > 0) {
                    TextButton(onClick = { step -= 1 }, enabled = !saving) {
                        Text(text = "Back", color = Color(0xFF8E8E96))
                    }
                }
                Spacer(modifier = Modifier.weight(1f))
                Button(
                    onClick = {
                        if (!canContinue || saving) return@Button
                        if (step < 3) {
                            step += 1
                        } else {
                            coroutineScope.launch {
                                saving = true
                                error = null
                                val normalized = settings.copy(futureMessage = settings.futureMessage.trim())
                                runCatching {
                                    WebServerService.saveOnboarding(normalized)
                                    WebServerService.syncDefaultGroups(normalized.scrollingWorst)
                                }.onSuccess {
                                    onComplete(normalized)
                                }.onFailure { throwable ->
                                    error = throwable.message ?: "Could not save onboarding."
                                }
                                saving = false
                            }
                        }
                    },
                    enabled = canContinue && !saving,
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF0A84FF),
                        contentColor = Color.White,
                        disabledContainerColor = Color(0xFF1F1F22),
                        disabledContentColor = Color(0xFF6D6D73)
                    )
                ) {
                    Text(
                        text = when {
                            saving -> "Saving..."
                            step < 3 -> "Continue"
                            else -> "Finish"
                        },
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
private fun OnboardingChoiceRow(
    label: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(if (selected) Color(0x1F4A9EFF) else Color(0xFF1F1F22))
            .clickable(onClick = onClick)
            .padding(18.dp)
    ) {
        Text(
            text = label,
            color = Color.White,
            fontSize = 17.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
        )
    }
}

@Composable
private fun OnboardingStrictnessRow(
    option: OnboardingStrictnessOption,
    selected: Boolean,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(if (selected) Color(0x1F4A9EFF) else Color(0xFF1F1F22))
            .clickable(onClick = onClick)
            .padding(18.dp)
    ) {
        Text(
            text = option.label,
            color = Color.White,
            fontSize = 17.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = option.description,
            color = Color(0xFF8E8E96),
            fontSize = 14.sp,
            lineHeight = 20.sp
        )
    }
}

private data class OnboardingStrictnessOption(
    val value: String,
    val label: String,
    val description: String
)
