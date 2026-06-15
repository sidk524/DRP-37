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
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drp37.blocker.remote.webserver.OnboardingSettings
import com.drp37.blocker.remote.webserver.AccountabilityPreferences
import com.drp37.blocker.remote.webserver.WebServerService
import kotlinx.coroutines.launch

private val goalOptions = listOf("Read more", "Exercise", "Call family", "Creative work")
private val worstTimeOptions = listOf("Late night", "First thing morning", "Meals", "Work hours")
private val strictnessOptions = listOf(
    StrictnessOption(
        value = "gentle",
        label = "Gentle nudges",
        description = "Gentle: a short breathing pause, then you can continue."
    ),
    StrictnessOption(
        value = "moderate",
        label = "Firm friction",
        description = "Firm: breathing, message typing, and goal reminder."
    ),
    StrictnessOption(
        value = "hard",
        label = "Hard block",
        description = "Hard: no way through until your session ends."
    )
)
private const val letterPlaceholder = "You said you wanted to read before bed. Put the phone down. You'll feel better."

@Composable
fun OnboardingSettingsScreen(
    onBack: () -> Unit,
    onSaved: (OnboardingSettings) -> Unit = {}
) {
    val coroutineScope = rememberCoroutineScope()
    var settings by remember { mutableStateOf(OnboardingSettings()) }
    var loading by remember { mutableStateOf(true) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var saved by remember { mutableStateOf(false) }
    var accountability by remember { mutableStateOf(AccountabilityPreferences()) }

    LaunchedEffect(Unit) {
        loading = true
        runCatching { WebServerService.loadOnboarding() to WebServerService.getAccountabilityPreferences() }
            .onSuccess { (loaded, loadedAccountability) ->
                settings = loaded ?: OnboardingSettings(
                    futureMessage = "",
                    strictness = "moderate"
                )
                accountability = loadedAccountability
            }
            .onFailure { throwable ->
                error = throwable.message ?: "Could not load settings."
            }
        loading = false
    }

    fun update(next: OnboardingSettings) {
        settings = next
        saved = false
    }

    fun toggleGoal(value: String) {
        val next = if (value in settings.goals) {
            settings.goals.filterNot { it == value }
        } else {
            settings.goals + value
        }
        update(settings.copy(goals = next))
    }

    fun toggleWorstTime(value: String) {
        val next = if (value in settings.scrollingWorst) {
            settings.scrollingWorst.filterNot { it == value }
        } else {
            settings.scrollingWorst + value
        }
        update(settings.copy(scrollingWorst = next))
    }

    val canSave = settings.goals.isNotEmpty() &&
        settings.scrollingWorst.isNotEmpty() &&
        settings.futureMessage.trim().isNotEmpty()

    Surface(modifier = Modifier.fillMaxSize(), color = Color.Black) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp, vertical = 28.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = onBack) {
                    Text(text = "Back", color = Color(0xFF0A84FF), fontSize = 16.sp)
                }
                Spacer(modifier = Modifier.weight(1f))
                Text(text = "Settings", color = Color(0xFF8E8E96), fontSize = 16.sp)
                Spacer(modifier = Modifier.weight(1f))
                Box(modifier = Modifier)
            }

            Spacer(modifier = Modifier.height(22.dp))

            Text(
                text = "Edit onboarding",
                color = Color.White,
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Update the choices Tether uses for reminders and friction.",
                color = Color(0xFF8E8E96),
                fontSize = 16.sp,
                modifier = Modifier.padding(top = 8.dp, bottom = 18.dp)
            )

            if (loading) {
                Text(text = "Loading settings...", color = Color(0xFF8E8E96))
            } else {
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    SettingsSection(
                        section = "Accountability",
                        title = "Friend accountability"
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "Share my session activity and notify friends about blocked-app attempts",
                                color = Color.White,
                                modifier = Modifier.weight(1f)
                            )
                            Switch(
                                checked = accountability.shareActivity,
                                onCheckedChange = { accountability = accountability.copy(shareActivity = it); saved = false }
                            )
                        }
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "Notify me about friends' blocked-app attempts",
                                color = Color.White,
                                modifier = Modifier.weight(1f)
                            )
                            Switch(
                                checked = accountability.receiveFriendAlerts,
                                onCheckedChange = { accountability = accountability.copy(receiveFriendAlerts = it); saved = false }
                            )
                        }
                    }

                    SettingsSection(
                        section = "Goals",
                        title = "What do you wish you did more of?"
                    ) {
                        goalOptions.forEach { option ->
                            ChoiceRow(
                                label = option,
                                selected = option in settings.goals,
                                onClick = { toggleGoal(option) }
                            )
                        }
                    }

                    SettingsSection(
                        section = "Worst times",
                        title = "When is scrolling worst for you?"
                    ) {
                        worstTimeOptions.forEach { option ->
                            ChoiceRow(
                                label = option,
                                selected = option in settings.scrollingWorst,
                                onClick = { toggleWorstTime(option) }
                            )
                        }
                    }

                    SettingsSection(
                        section = "Letter to self",
                        title = "Future-self message"
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color(0x1A4A9EFF))
                                .padding(16.dp)
                        ) {
                            Text(
                                text = settings.futureMessage.trim().ifBlank { letterPlaceholder },
                                color = Color.White,
                                fontSize = 15.sp,
                                lineHeight = 22.sp,
                                fontStyle = FontStyle.Italic
                            )
                        }
                        Spacer(modifier = Modifier.height(10.dp))
                        OutlinedTextField(
                            value = settings.futureMessage,
                            onValueChange = { update(settings.copy(futureMessage = it)) },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 4,
                            label = { Text(text = "Message") },
                            placeholder = { Text(text = letterPlaceholder) }
                        )
                    }

                    SettingsSection(
                        section = "Strictness",
                        title = "How strict should we be?"
                    ) {
                        strictnessOptions.forEach { option ->
                            StrictnessRow(
                                option = option,
                                selected = settings.strictness == option.value,
                                onClick = { update(settings.copy(strictness = option.value)) }
                            )
                        }
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
            if (saved) {
                Text(
                    text = "Settings saved.",
                    color = Color(0xFF30D158),
                    fontSize = 14.sp,
                    modifier = Modifier.padding(top = 12.dp)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))
            Button(
                onClick = {
                    if (!canSave || saving) return@Button
                    coroutineScope.launch {
                        saving = true
                        error = null
                        saved = false
                        runCatching {
                            val normalized = settings.copy(futureMessage = settings.futureMessage.trim())
                            WebServerService.saveOnboarding(normalized)
                            WebServerService.syncDefaultGroups(normalized.scrollingWorst)
                            accountability = WebServerService.updateAccountabilityPreferences(accountability)
                            settings = normalized
                        }.onSuccess {
                            saved = true
                            onSaved(settings)
                        }.onFailure { throwable ->
                            error = throwable.message ?: "Could not save settings."
                        }
                        saving = false
                    }
                },
                enabled = canSave && !loading && !saving,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF0A84FF),
                    contentColor = Color.White,
                    disabledContainerColor = Color(0xFF1F1F22),
                    disabledContentColor = Color(0xFF6D6D73)
                )
            ) {
                Text(
                    text = if (saving) "Saving..." else "Save settings",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun SettingsSection(
    section: String,
    title: String,
    content: @Composable () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Color(0xFF1F1F22))
            .padding(18.dp)
    ) {
        Text(
            text = section.uppercase(),
            color = Color(0xFF8E8E96),
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.7.sp
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = title,
            color = Color.White,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(14.dp))
        content()
    }
}

@Composable
private fun ChoiceRow(
    label: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 10.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(if (selected) Color(0x1F4A9EFF) else Color.Black)
            .clickable(onClick = onClick)
            .padding(14.dp)
    ) {
        Text(
            text = label,
            color = Color.White,
            fontSize = 16.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
        )
    }
}

@Composable
private fun StrictnessRow(
    option: StrictnessOption,
    selected: Boolean,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 10.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(if (selected) Color(0x1F4A9EFF) else Color.Black)
            .clickable(onClick = onClick)
            .padding(14.dp)
    ) {
        Text(
            text = option.label,
            color = Color.White,
            fontSize = 16.sp,
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

private data class StrictnessOption(
    val value: String,
    val label: String,
    val description: String
)
