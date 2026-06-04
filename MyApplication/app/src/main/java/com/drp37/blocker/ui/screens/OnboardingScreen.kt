package com.drp37.blocker.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drp37.blocker.model.OnboardingChoiceOption
import com.drp37.blocker.model.OnboardingResponses
import com.drp37.blocker.ui.theme.MyApplicationTheme
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight

private val OnboardingCard = Color(0xFF2A2A2A)
private val OnboardingBorder = Color(0xFF3A3A3A)
private val OnboardingAccent = Color(0xFF4A9EFF)
private val OnboardingTextSubtle = Color(0xFF888888)
private val OnboardingOptionBg = Color(0xFF111111)
private val OnboardingSelectedBg = Color(0x1F4A9EFF)
private val OnboardingGentleBg = Color(0x1A34C759)
private val OnboardingFirmBg = Color(0x1A4A9EFF)
private val OnboardingHardBg = Color(0x1AFF6363)
private val OnboardingGentleBorder = Color(0xB334C759)
private val OnboardingFirmBorder = Color(0xFF4A9EFF)
private val OnboardingHardBorder = Color(0xB3FF6363)
private val OnboardingError = Color(0xFFFF6B6B)
private val OnboardingCta = Color(0xFF0A84FF)
private val OnboardingCtaDisabled = Color(0xFF323232)

private const val LetterPlaceholder =
    "You said you wanted to read before bed. Put the phone down. You'll feel better."

private val GoalOptions = listOf(
    OnboardingChoiceOption("Read more", "📖"),
    OnboardingChoiceOption("Exercise", "🏃"),
    OnboardingChoiceOption("Call family", "📞"),
    OnboardingChoiceOption("Creative work", "🎨"),
)

private val WorstTimeOptions = listOf(
    OnboardingChoiceOption("Late night", "🌙"),
    OnboardingChoiceOption("First thing morning", "☀️"),
    OnboardingChoiceOption("Meals", "🍽️"),
    OnboardingChoiceOption("Work hours", "💼"),
)

private data class StrictnessUi(
    val value: String,
    val label: String,
    val icon: String,
    val description: String,
    val background: Color,
    val selectedBorder: Color,
)

private val StrictnessOptions = listOf(
    StrictnessUi(
        value = "gentle",
        label = "Gentle nudges",
        icon = "🌱",
        description = "Gentle: a short breathing pause, then you can continue.",
        background = OnboardingGentleBg,
        selectedBorder = OnboardingGentleBorder,
    ),
    StrictnessUi(
        value = "moderate",
        label = "Firm friction",
        icon = "🔒",
        description = "Firm: 10s pause + intention check. You can still get through.",
        background = OnboardingFirmBg,
        selectedBorder = OnboardingFirmBorder,
    ),
    StrictnessUi(
        value = "strict",
        label = "Hard block",
        icon = "🧱",
        description = "Hard: blocked apps close. No way through until your session ends.",
        background = OnboardingHardBg,
        selectedBorder = OnboardingHardBorder,
    ),
)

@Composable
fun OnboardingScreen(
    isSaving: Boolean,
    errorMessage: String?,
    onComplete: (OnboardingResponses) -> Unit,
) {
    var step by remember { mutableStateOf(0) }
    var doMoreOf by remember { mutableStateOf(setOf<String>()) }
    var scrollingWorst by remember { mutableStateOf(setOf<String>()) }
    var futureMessage by remember { mutableStateOf("") }
    var strictness by remember { mutableStateOf("moderate") }

    val canAdvance = when (step) {
        0 -> doMoreOf.isNotEmpty()
        1 -> scrollingWorst.isNotEmpty()
        2 -> futureMessage.trim().isNotEmpty()
        else -> true
    }

    val ctaLabel = when (step) {
        0, 1 -> "Continue"
        2 -> "Save & continue"
        else -> "Done"
    }

    val selectedStrictness = StrictnessOptions.firstOrNull { it.value == strictness }

    Surface(modifier = Modifier.fillMaxSize(), color = Color.Black) {
        BoxWithConstraints(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            val contentWidth = (maxWidth * 0.9f).coerceAtMost(420.dp)
            val cardRadius = 20.dp
            val optionRadius = 14.dp

            Column(
                modifier = Modifier
                    .width(contentWidth)
                    .padding(horizontal = 20.dp, vertical = 24.dp),
                horizontalAlignment = Alignment.Start
            ) {
                if (step > 0) {
                    TextButton(
                        onClick = { if (!isSaving) step -= 1 },
                        enabled = !isSaving
                    ) {
                        Text(
                            text = "← Back",
                            color = OnboardingTextSubtle,
                            fontSize = 15.sp
                        )
                    }
                } else {
                    Spacer(modifier = Modifier.height(40.dp))
                }

                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(cardRadius),
                    color = OnboardingCard,
                    border = androidx.compose.foundation.BorderStroke(1.dp, OnboardingBorder)
                ) {
                    Column(
                        modifier = Modifier
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 24.dp, vertical = 28.dp),
                        verticalArrangement = Arrangement.spacedBy(20.dp)
                    ) {
                        when (step) {
                            0 -> {
                                OnboardingSectionLabel("Goals")
                                OnboardingQuestion("What do you wish you did more of?")
                                GoalOptions.forEach { option ->
                                    OnboardingChoiceRow(
                                        option = option,
                                        selected = doMoreOf.contains(option.label),
                                        optionRadius = optionRadius,
                                        onClick = {
                                            doMoreOf = doMoreOf.toggle(option.label)
                                        }
                                    )
                                }
                            }

                            1 -> {
                                OnboardingSectionLabel("Worst times")
                                OnboardingQuestion("When is scrolling worst for you?")
                                WorstTimeOptions.forEach { option ->
                                    OnboardingChoiceRow(
                                        option = option,
                                        selected = scrollingWorst.contains(option.label),
                                        optionRadius = optionRadius,
                                        onClick = {
                                            scrollingWorst = scrollingWorst.toggle(option.label)
                                        }
                                    )
                                }
                            }

                            2 -> {
                                OnboardingSectionLabel("Letter to self")
                                Text(
                                    text = "Write a message to your future self. This shows when you're about to open a blocked app.",
                                    color = OnboardingTextSubtle,
                                    fontSize = 15.sp,
                                    lineHeight = 22.sp
                                )
                                LetterPreview(
                                    message = futureMessage.trim().ifEmpty { LetterPlaceholder }
                                )
                                LetterInput(
                                    value = futureMessage,
                                    onValueChange = { futureMessage = it }
                                )
                            }

                            else -> {
                                OnboardingSectionLabel("Strictness")
                                OnboardingQuestion("How strict should we be?")
                                StrictnessOptions.forEach { option ->
                                    StrictnessRow(
                                        option = option,
                                        selected = strictness == option.value,
                                        optionRadius = optionRadius,
                                        onClick = { strictness = option.value }
                                    )
                                }
                                if (selectedStrictness != null) {
                                    Text(
                                        text = selectedStrictness.description,
                                        color = OnboardingTextSubtle,
                                        fontSize = 14.sp,
                                        lineHeight = 20.sp
                                    )
                                }
                            }
                        }

                        if (errorMessage != null) {
                            Text(
                                text = errorMessage,
                                color = OnboardingError,
                                fontSize = 14.sp
                            )
                        }

                        Button(
                            onClick = {
                                if (step < 3) {
                                    step += 1
                                } else {
                                    onComplete(
                                        OnboardingResponses(
                                            doMoreOf = doMoreOf.toList(),
                                            scrollingWorst = scrollingWorst.toList(),
                                            futureMessage = futureMessage,
                                            strictness = strictness,
                                        )
                                    )
                                }
                            },
                            enabled = canAdvance && !isSaving,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = OnboardingCta,
                                disabledContainerColor = OnboardingCtaDisabled,
                                contentColor = Color.White,
                                disabledContentColor = OnboardingTextSubtle
                            )
                        ) {
                            Text(
                                text = if (isSaving) "Saving…" else ctaLabel,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun Set<String>.toggle(item: String): Set<String> =
    if (contains(item)) minus(item) else plus(item)

@Composable
private fun OnboardingSectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        color = OnboardingTextSubtle,
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 1.sp
    )
}

@Composable
private fun OnboardingQuestion(text: String) {
    Text(
        text = text,
        color = Color.White,
        fontSize = 22.sp,
        fontWeight = FontWeight.Bold,
        lineHeight = 28.sp
    )
}

@Composable
private fun OnboardingChoiceRow(
    option: OnboardingChoiceOption,
    selected: Boolean,
    optionRadius: androidx.compose.ui.unit.Dp,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(optionRadius)
    val background = if (selected) OnboardingSelectedBg else OnboardingOptionBg
    val borderColor = if (selected) OnboardingAccent else OnboardingBorder

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(background)
            .border(1.dp, borderColor, shape)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text(text = option.icon, fontSize = 20.sp)
        Text(
            text = option.label,
            color = Color.White,
            fontSize = 16.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun StrictnessRow(
    option: StrictnessUi,
    selected: Boolean,
    optionRadius: androidx.compose.ui.unit.Dp,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(optionRadius)
    val borderColor = if (selected) option.selectedBorder else OnboardingBorder

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(option.background)
            .border(1.dp, borderColor, shape)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text(text = option.icon, fontSize = 20.sp)
        Text(
            text = option.label,
            color = Color.White,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun LetterPreview(message: String) {
    val shape = RoundedCornerShape(topEnd = 14.dp, bottomEnd = 14.dp)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .clip(shape)
            .background(Color(0x1A4A9EFF))
    ) {
        Spacer(
            modifier = Modifier
                .width(4.dp)
                .fillMaxHeight()
                .background(OnboardingAccent)
        )
        Text(
            text = "“$message”",
            color = Color.White,
            fontSize = 15.sp,
            fontStyle = FontStyle.Italic,
            lineHeight = 22.sp,
            modifier = Modifier.padding(horizontal = 18.dp, vertical = 16.dp)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LetterInput(
    value: String,
    onValueChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier
            .fillMaxWidth()
            .height(120.dp),
        placeholder = {
            Text(
                text = LetterPlaceholder,
                color = OnboardingTextSubtle,
                fontSize = 14.sp
            )
        },
        textStyle = androidx.compose.ui.text.TextStyle(
            color = Color.White,
            fontSize = 15.sp,
            lineHeight = 22.sp
        ),
        shape = RoundedCornerShape(14.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = OnboardingOptionBg,
            unfocusedContainerColor = OnboardingOptionBg,
            focusedBorderColor = OnboardingAccent,
            unfocusedBorderColor = OnboardingBorder,
            cursorColor = Color.White
        )
    )
}

@Preview(showBackground = true)
@Composable
private fun OnboardingScreenPreview() {
    MyApplicationTheme {
        OnboardingScreen(
            isSaving = false,
            errorMessage = null,
            onComplete = {},
        )
    }
}
