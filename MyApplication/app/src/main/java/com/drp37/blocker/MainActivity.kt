package com.drp37.blocker

import android.content.Context
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.graphics.drawable.toBitmap
import com.drp37.blocker.ui.theme.MyApplicationTheme

private const val PREFS_NAME = "focus_block_prefs"
private const val KEY_BLOCK_LIST_PACKAGES = "block_list_packages"
private const val KEY_BLOCK_LIST_DURATION_MINUTES = "block_list_duration_minutes"
private const val KEY_BLOCKING_ENABLED = "blocking_enabled"
private const val MIN_BLOCK_MINUTES = 5
private const val MAX_BLOCK_MINUTES = 7 * 24 * 60

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MyApplicationTheme {
                BlockerSetupScreen()
            }
        }
    }
}

private data class InstalledApp(
    val label: String,
    val packageName: String,
    val icon: android.graphics.Bitmap
)

private data class SavedBlockList(
    val packages: Set<String>,
    val durationMinutes: Int,
    val blockingEnabled: Boolean
)

@Composable
fun BlockerSetupScreen() {
    val context = LocalContext.current
    val installedApps = remember { loadInstalledApps(context) }
    val savedBlockList = remember { loadSavedBlockList(context) }
    val selectedPackages = remember(installedApps) {
        mutableStateMapOf<String, Boolean>().apply {
            installedApps.forEach { app -> put(app.packageName, app.packageName in savedBlockList.packages) }
        }
    }
    var blockingEnabled by remember { mutableStateOf(savedBlockList.blockingEnabled) }
    var durationInput by remember { mutableStateOf(savedBlockList.durationMinutes.toString()) }
    var showAppPicker by remember { mutableStateOf(false) }

    val parsedDuration = durationInput.toIntOrNull()
    val durationMinutes = parsedDuration?.coerceIn(MIN_BLOCK_MINUTES, MAX_BLOCK_MINUTES)
    val selectedCount = selectedPackages.values.count { it }
    val selectedLabels = installedApps
        .filter { selectedPackages[it.packageName] == true }
        .map { it.label }
    val canSave = selectedCount > 0 && durationMinutes != null

    if (showAppPicker) {
        AppPickerDialog(
            installedApps = installedApps,
            selectedPackages = selectedPackages,
            onDismiss = { showAppPicker = false },
            onSave = { showAppPicker = false }
        )
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = Color.White
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 40.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(28.dp))

            Text(
                text = "FocusBlock",
                color = Color.Black,
                fontSize = 34.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.sp
            )

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = "Create one block list from apps installed on this phone.",
                color = Color(0xFF666666),
                fontSize = 16.sp,
                lineHeight = 22.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 10.dp)
            )

            Spacer(modifier = Modifier.height(34.dp))

            BlockingToggleCard(
                blockingEnabled = blockingEnabled,
                selectedCount = selectedCount,
                onToggle = { blockingEnabled = it }
            )

            Spacer(modifier = Modifier.height(26.dp))

            SectionTitle("Block duration")

            Spacer(modifier = Modifier.height(12.dp))

            DurationInputCard(
                value = durationInput,
                durationMinutes = durationMinutes,
                onValueChange = { newValue ->
                    durationInput = newValue.filter { it.isDigit() }.take(5)
                }
            )

            Spacer(modifier = Modifier.height(26.dp))

            SectionTitle("Block list")

            Spacer(modifier = Modifier.height(12.dp))

            SavedAppsSummaryCard(
                selectedCount = selectedCount,
                selectedLabels = selectedLabels,
                totalApps = installedApps.size,
                onChooseApps = { showAppPicker = true }
            )

            Spacer(modifier = Modifier.height(30.dp))

            Button(
                onClick = {
                    if (durationMinutes != null) {
                        val selectedPackageNames = selectedPackages
                            .filterValues { it }
                            .keys
                            .toSet()
                        saveBlockList(
                            context = context,
                            packages = selectedPackageNames,
                            durationMinutes = durationMinutes,
                            blockingEnabled = blockingEnabled
                        )
                        Toast.makeText(context, "Block list saved", Toast.LENGTH_SHORT).show()
                    }
                },
                enabled = canSave,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(58.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.Black,
                    contentColor = Color.White,
                    disabledContainerColor = Color(0xFFE5E5E5),
                    disabledContentColor = Color(0xFF888888)
                )
            ) {
                Text(
                    text = "Save block list",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Spacer(modifier = Modifier.height(18.dp))

            Text(
                text = summaryText(selectedCount, durationMinutes),
                color = Color(0xFF777777),
                fontSize = 14.sp,
                textAlign = TextAlign.Center
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AppPickerDialog(
    installedApps: List<InstalledApp>,
    selectedPackages: MutableMap<String, Boolean>,
    onDismiss: () -> Unit,
    onSave: () -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    val filteredApps = remember(installedApps, searchQuery) {
        val query = searchQuery.trim().lowercase()
        if (query.isBlank()) {
            installedApps
        } else {
            installedApps.filter { app ->
                app.label.lowercase().contains(query) || app.packageName.lowercase().contains(query)
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Choose apps",
                color = Color.Black,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .fillMaxHeight(0.72f)
            ) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    label = { Text("Search apps") },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Color.Black,
                        focusedLabelColor = Color.Black,
                        cursorColor = Color.Black
                    )
                )

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = "${filteredApps.size} launchable apps",
                    color = Color(0xFF666666),
                    fontSize = 14.sp
                )

                Spacer(modifier = Modifier.height(12.dp))

                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    filteredApps.forEach { app ->
                        AppCheckboxRow(
                            app = app,
                            checked = selectedPackages[app.packageName] == true,
                            onCheckedChange = { selectedPackages[app.packageName] = it }
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onSave,
                colors = ButtonDefaults.buttonColors(containerColor = Color.Black)
            ) {
                Text("Save apps")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = Color.Black)
            }
        },
        containerColor = Color.White
    )
}

@Composable
private fun AppCheckboxRow(
    app: InstalledApp,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFFF8F8F8))
            .clickable { onCheckedChange(!checked) }
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Image(
            bitmap = app.icon.asImageBitmap(),
            contentDescription = null,
            modifier = Modifier
                .size(38.dp)
                .clip(RoundedCornerShape(8.dp))
        )

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = app.label,
                color = Color.Black,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = app.packageName,
                color = Color(0xFF8A8A8A),
                fontSize = 11.sp,
                maxLines = 1
            )
        }

        Checkbox(
            checked = checked,
            onCheckedChange = onCheckedChange
        )
    }
}

@Composable
private fun BlockingToggleCard(
    blockingEnabled: Boolean,
    selectedCount: Int,
    onToggle: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Color(0xFFE0E0E0), RoundedCornerShape(16.dp))
            .padding(horizontal = 18.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Blocking",
                color = Color.Black,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = if (blockingEnabled) "$selectedCount apps ready" else "Saved list is paused",
                color = Color(0xFF777777),
                fontSize = 14.sp,
                modifier = Modifier.padding(top = 3.dp)
            )
        }
        Switch(
            checked = blockingEnabled,
            onCheckedChange = onToggle
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DurationInputCard(
    value: String,
    durationMinutes: Int?,
    onValueChange: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFF8F8F8), RoundedCornerShape(14.dp))
            .padding(16.dp)
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            label = { Text("Minutes") },
            supportingText = { Text("Any value from 5 minutes to 10,080 minutes") },
            isError = durationMinutes == null,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Color.Black,
                focusedLabelColor = Color.Black,
                cursorColor = Color.Black
            )
        )

        Spacer(modifier = Modifier.height(10.dp))

        Text(
            text = durationMinutes?.let { "Selected duration: ${formatDuration(it)}" }
                ?: "Enter at least 5 minutes",
            color = if (durationMinutes == null) Color(0xFFB00020) else Color(0xFF666666),
            fontSize = 14.sp
        )
    }
}

@Composable
private fun SavedAppsSummaryCard(
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
            Text(
                text = "$selectedCount apps selected",
                color = Color.Black,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = if (selectedLabels.isEmpty()) {
                    "No apps selected yet. $totalApps installed apps available."
                } else {
                    selectedLabels.take(4).joinToString(", ") + if (selectedLabels.size > 4) " +${selectedLabels.size - 4} more" else ""
                },
                color = Color(0xFF666666),
                fontSize = 14.sp,
                lineHeight = 20.sp,
                modifier = Modifier.padding(top = 5.dp)
            )

            Spacer(modifier = Modifier.height(14.dp))

            OutlinedButton(
                onClick = onChooseApps,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text(
                    text = "Choose apps",
                    color = Color.Black,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
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

private fun loadInstalledApps(context: Context): List<InstalledApp> {
    val packageManager = context.packageManager
    val launcherIntent = android.content.Intent(android.content.Intent.ACTION_MAIN)
        .addCategory(android.content.Intent.CATEGORY_LAUNCHER)

    return packageManager.queryIntentActivities(launcherIntent, PackageManager.MATCH_ALL)
        .asSequence()
        .mapNotNull { resolveInfo ->
            val packageName = resolveInfo.activityInfo?.packageName ?: return@mapNotNull null
            if (packageName == context.packageName) return@mapNotNull null
            val label = resolveInfo.loadLabel(packageManager)?.toString()?.trim().orEmpty()
            val displayLabel = label.ifBlank { packageName }
            InstalledApp(
                label = displayLabel,
                packageName = packageName,
                icon = resolveInfo.loadIcon(packageManager).toBitmap(width = 96, height = 96)
            )
        }
        .distinctBy { it.packageName }
        .sortedBy { it.label.lowercase() }
        .toList()
}

private fun loadSavedBlockList(context: Context): SavedBlockList {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val packages = prefs.getString(KEY_BLOCK_LIST_PACKAGES, "")
        .orEmpty()
        .split('|')
        .filter { it.isNotBlank() }
        .toSet()
    val durationMinutes = prefs
        .getInt(KEY_BLOCK_LIST_DURATION_MINUTES, 60)
        .coerceIn(MIN_BLOCK_MINUTES, MAX_BLOCK_MINUTES)
    val blockingEnabled = prefs.getBoolean(KEY_BLOCKING_ENABLED, true)

    return SavedBlockList(
        packages = packages,
        durationMinutes = durationMinutes,
        blockingEnabled = blockingEnabled
    )
}

private fun saveBlockList(
    context: Context,
    packages: Set<String>,
    durationMinutes: Int,
    blockingEnabled: Boolean
) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY_BLOCK_LIST_PACKAGES, packages.sorted().joinToString("|"))
        .putInt(KEY_BLOCK_LIST_DURATION_MINUTES, durationMinutes.coerceIn(MIN_BLOCK_MINUTES, MAX_BLOCK_MINUTES))
        .putBoolean(KEY_BLOCKING_ENABLED, blockingEnabled)
        .apply()
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

private fun summaryText(selectedCount: Int, durationMinutes: Int?): String {
    return if (durationMinutes == null) {
        "$selectedCount apps selected - invalid duration"
    } else {
        "$selectedCount apps selected - ${formatDuration(durationMinutes)} block duration"
    }
}

@Preview(showBackground = true)
@Composable
fun BlockerSetupPreview() {
    MyApplicationTheme {
        BlockerSetupScreen()
    }
}
