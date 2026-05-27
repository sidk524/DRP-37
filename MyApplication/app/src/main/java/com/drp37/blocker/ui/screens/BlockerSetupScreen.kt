package com.drp37.blocker.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drp37.blocker.data.loadBlockList
import com.drp37.blocker.data.loadLaunchableApps
import com.drp37.blocker.data.saveBlockList
import com.drp37.blocker.model.BlockList
import com.drp37.blocker.ui.components.AppPickerDialog
import com.drp37.blocker.ui.components.LockSessionDialog
import com.drp37.blocker.ui.theme.MyApplicationTheme

@Composable
fun BlockerSetupScreen() {
    val context = LocalContext.current
    val installedApps = remember { loadLaunchableApps(context) }
    val savedBlockList = remember { loadBlockList(context) }
    val selectedPackages = remember(installedApps) {
        mutableStateMapOf<String, Boolean>().apply {
            installedApps.forEach { app -> put(app.packageName, app.packageName in savedBlockList.packages) }
        }
    }
    val savedDuration = remember(savedBlockList.durationMinutes) { splitDuration(savedBlockList.durationMinutes) }
    var daysInput by remember { mutableStateOf(savedDuration.days.toString()) }
    var hoursInput by remember { mutableStateOf(savedDuration.hours.toString()) }
    var minutesInput by remember { mutableStateOf(savedDuration.minutes.toString()) }
    var showAppPicker by remember { mutableStateOf(false) }
    var activeSessionMinutes by remember { mutableIntStateOf(0) }

    val durationMinutes = totalDurationMinutes(daysInput, hoursInput, minutesInput)
    val selectedPackageSet = selectedPackages.filterValues { it }.keys.toSet()
    val selectedLabels = installedApps.filter { it.packageName in selectedPackageSet }.map { it.label }
    val canStart = selectedPackageSet.isNotEmpty() && durationMinutes != null

    if (showAppPicker) {
        AppPickerDialog(
            installedApps = installedApps,
            selectedPackages = selectedPackages,
            onDismiss = { showAppPicker = false },
            onSave = { showAppPicker = false }
        )
    }

    if (activeSessionMinutes > 0) {
        LockSessionDialog(
            durationMinutes = activeSessionMinutes,
            onStop = { activeSessionMinutes = 0 }
        )
    }

    Surface(modifier = Modifier.fillMaxSize(), color = Color.White) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 40.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(32.dp))

            Text(
                text = "FocusBlock",
                color = Color.Black,
                fontSize = 34.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.sp
            )

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = "Select your block list, set a duration, then start the lock session.",
                color = Color(0xFF666666),
                fontSize = 16.sp,
                lineHeight = 22.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 8.dp)
            )

            Spacer(modifier = Modifier.height(36.dp))

            SectionTitle("Selected block list")
            Spacer(modifier = Modifier.height(12.dp))
            BlockListCard(
                selectedCount = selectedPackageSet.size,
                selectedLabels = selectedLabels,
                totalApps = installedApps.size,
                onChooseApps = { showAppPicker = true }
            )

            Spacer(modifier = Modifier.height(28.dp))

            SectionTitle("Duration")
            Spacer(modifier = Modifier.height(12.dp))
            DurationInputCard(
                days = daysInput,
                hours = hoursInput,
                minutes = minutesInput,
                durationMinutes = durationMinutes,
                onDaysChange = { daysInput = it.filter(Char::isDigit).take(4) },
                onHoursChange = { hoursInput = it.filter(Char::isDigit).take(3) },
                onMinutesChange = { minutesInput = it.filter(Char::isDigit).take(3) }
            )

            Spacer(modifier = Modifier.height(34.dp))

            Button(
                onClick = {
                    val minutes = durationMinutes ?: return@Button
                    saveBlockList(
                        context = context,
                        blockList = BlockList(
                            packages = selectedPackageSet,
                            durationMinutes = minutes
                        )
                    )
                    Toast.makeText(context, "Blocking started", Toast.LENGTH_SHORT).show()
                    activeSessionMinutes = minutes
                },
                enabled = canStart,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(60.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.Black,
                    contentColor = Color.White,
                    disabledContainerColor = Color(0xFFE5E5E5),
                    disabledContentColor = Color(0xFF888888)
                )
            ) {
                Text("Start", fontSize = 20.sp, fontWeight = FontWeight.Bold)
            }

            Spacer(modifier = Modifier.height(18.dp))

            Text(
                text = sessionSummary(selectedPackageSet.size, durationMinutes),
                color = Color(0xFF777777),
                fontSize = 14.sp,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun BlockListCard(
    selectedCount: Int,
    selectedLabels: List<String>,
    totalApps: Int,
    onChooseApps: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF8F8F8)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Main block list",
                        color = Color.Black,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "$selectedCount apps selected",
                        color = Color(0xFF666666),
                        fontSize = 14.sp,
                        modifier = Modifier.padding(top = 3.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = if (selectedLabels.isEmpty()) {
                    "No apps selected yet. $totalApps launchable apps available."
                } else {
                    selectedLabels.take(4).joinToString(", ") + if (selectedLabels.size > 4) " +${selectedLabels.size - 4} more" else ""
                },
                color = Color(0xFF666666),
                fontSize = 14.sp,
                lineHeight = 20.sp
            )

            Spacer(modifier = Modifier.height(14.dp))

            OutlinedButton(
                onClick = onChooseApps,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text("Choose apps", color = Color.Black, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DurationInputCard(
    days: String,
    hours: String,
    minutes: String,
    durationMinutes: Int?,
    onDaysChange: (String) -> Unit,
    onHoursChange: (String) -> Unit,
    onMinutesChange: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFF8F8F8), RoundedCornerShape(14.dp))
            .padding(16.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth()) {
            DurationField(
                value = days,
                label = "Days",
                modifier = Modifier.weight(1f),
                onValueChange = onDaysChange
            )
            Spacer(modifier = Modifier.padding(horizontal = 5.dp))
            DurationField(
                value = hours,
                label = "Hours",
                modifier = Modifier.weight(1f),
                onValueChange = onHoursChange
            )
            Spacer(modifier = Modifier.padding(horizontal = 5.dp))
            DurationField(
                value = minutes,
                label = "Minutes",
                modifier = Modifier.weight(1f),
                onValueChange = onMinutesChange
            )
        }

        Spacer(modifier = Modifier.height(10.dp))

        Text(
            text = durationMinutes?.let { "Session length: ${formatDuration(it)}" }
                ?: "Enter a duration greater than zero",
            color = if (durationMinutes == null) Color(0xFFB00020) else Color(0xFF666666),
            fontSize = 14.sp
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DurationField(
    value: String,
    label: String,
    modifier: Modifier,
    onValueChange: (String) -> Unit
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        singleLine = true,
        label = { Text(label) },
        isError = false,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Color.Black,
            focusedLabelColor = Color.Black,
            cursorColor = Color.Black
        )
    )
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text = text,
        color = Color.Black,
        fontSize = 20.sp,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.fillMaxWidth()
    )
}

private data class DurationParts(
    val days: Int,
    val hours: Int,
    val minutes: Int
)

private fun splitDuration(totalMinutes: Int): DurationParts {
    val days = totalMinutes / (24 * 60)
    val hours = (totalMinutes % (24 * 60)) / 60
    val minutes = totalMinutes % 60
    return DurationParts(days, hours, minutes)
}

private fun totalDurationMinutes(days: String, hours: String, minutes: String): Int? {
    val total = (days.toIntOrNull() ?: 0) * 24 * 60 +
        (hours.toIntOrNull() ?: 0) * 60 +
        (minutes.toIntOrNull() ?: 0)
    return total.takeIf { it > 0 }
}

private fun sessionSummary(selectedCount: Int, durationMinutes: Int?): String {
    return if (durationMinutes == null) {
        "$selectedCount apps selected - invalid duration"
    } else {
        "$selectedCount apps selected - ${formatDuration(durationMinutes)} session"
    }
}

private fun formatDuration(minutes: Int): String {
    val days = minutes / (24 * 60)
    val hours = (minutes % (24 * 60)) / 60
    val mins = minutes % 60
    val parts = buildList {
        if (days > 0) add("${days}d")
        if (hours > 0) add("${hours}h")
        if (mins > 0 || isEmpty()) add("${mins}m")
    }
    return parts.joinToString(" ")
}

@Preview(showBackground = true)
@Composable
fun BlockerSetupPreview() {
    MyApplicationTheme {
        BlockerSetupScreen()
    }
}
