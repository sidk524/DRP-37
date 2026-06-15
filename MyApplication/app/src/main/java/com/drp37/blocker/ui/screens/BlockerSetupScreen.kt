package com.drp37.blocker.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drp37.blocker.blocking.isAppBlockingServiceEnabled
import com.drp37.blocker.blocking.openAppBlockingSettings
import com.drp37.blocker.remote.webserver.OnboardingSettings
import com.drp37.blocker.remote.webserver.SessionSyncClient
import com.drp37.blocker.remote.webserver.WebServerService
import com.drp37.blocker.remote.webserver.strictnessToMode
import com.drp37.blocker.ui.session.BlockerSessionViewModel
import com.drp37.blocker.util.loadLaunchableApps
import com.drp37.blocker.model.InstalledApp
import com.drp37.blocker.ui.components.NotificationBellButton
import com.drp37.blocker.ui.theme.MyApplicationTheme
import com.drp37.blocker.ui.theme.formatDurationPill
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.viewmodel.compose.viewModel
import java.time.Duration
import java.time.Instant
import kotlin.math.max
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun BlockerSetupScreen(
    onboardingSettings: OnboardingSettings? = null,
    pendingOpenInbox: Boolean = false,
    onOpenInboxHandled: () -> Unit = {},
    onLogout: () -> Unit = {}
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val installedApps = remember { loadLaunchableApps(context) }
    val installedPackages = remember(installedApps) { installedApps.map { it.packageName }.toSet() }
    val sessionViewModel: BlockerSessionViewModel = viewModel()
    val sessionState by sessionViewModel.state.collectAsState()
    var showAccessibilityDialog by remember { mutableStateOf(false) }
    var screen by remember { mutableStateOf(BlockerFlowScreen.Duration) }
    var editingGroupId by remember { mutableStateOf<String?>(null) }
    var editorName by remember { mutableStateOf("") }
    var editorPackages by remember { mutableStateOf(setOf<String>()) }
    var editorEntries by remember { mutableStateOf(listOf<String>()) }
    var pickerDraftGroupId by remember { mutableStateOf<String?>(null) }
    var accountabilityUnread by remember { mutableStateOf(0) }
    val defaultMode = strictnessToMode(onboardingSettings?.strictness ?: "moderate")

    LaunchedEffect(Unit) {
        runCatching { WebServerService.getAccountabilityInbox() }
            .onSuccess { accountabilityUnread = it.second }
        SessionSyncClient.unreadCount.collect { accountabilityUnread = it }
    }

    LaunchedEffect(pendingOpenInbox) {
        if (pendingOpenInbox) {
            screen = BlockerFlowScreen.Inbox
            onOpenInboxHandled()
        }
    }

    LaunchedEffect(installedPackages) {
        sessionViewModel.setInstalledPackages(installedPackages)
    }

    fun openGroupEditor(group: com.drp37.blocker.remote.webserver.BlockGroup?) {
        editingGroupId = group?.id
        editorName = group?.name.orEmpty()
        editorPackages = group?.expandedAppsBlocked?.toSet().orEmpty()
        editorEntries = group?.let { (it.targets + it.domainsBlocked).distinct() }.orEmpty()
        sessionViewModel.clearError()
        screen = BlockerFlowScreen.GroupEditor
    }

    fun showAccessibilityPromptIfNeeded() {
        if (isAppBlockingServiceEnabled(context)) {
            sessionViewModel.clearError()
            showAccessibilityDialog = false
        } else {
            showAccessibilityDialog = true
        }
    }

    LaunchedEffect(Unit) {
        showAccessibilityPromptIfNeeded()
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                showAccessibilityPromptIfNeeded()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    LaunchedEffect(defaultMode) {
        sessionViewModel.restore(defaultMode)
    }

    LaunchedEffect(defaultMode, sessionState.sessionRunning) {
        if (!sessionState.sessionRunning) {
            sessionViewModel.setMode(defaultMode)
        }
    }

    LaunchedEffect(screen) {
        if (screen == BlockerFlowScreen.GroupPicker) {
            pickerDraftGroupId = sessionState.selectedBlockGroupId
        }
    }

    when (screen) {
        BlockerFlowScreen.Settings -> {
            OnboardingSettingsScreen(
                onBack = { screen = BlockerFlowScreen.Duration },
                onSaved = { settings ->
                    sessionViewModel.setMode(strictnessToMode(settings.strictness))
                }
            )
        }
        BlockerFlowScreen.AppSelection -> {
            AppSelectionScreen(
                installedApps = installedApps,
                selectedPackages = editorPackages,
                locked = false,
                onTogglePackage = { packageName ->
                    editorPackages = if (packageName in editorPackages) {
                        editorPackages - packageName
                    } else {
                        editorPackages + packageName
                    }
                },
                onDone = { screen = BlockerFlowScreen.GroupEditor }
            )
        }
        BlockerFlowScreen.GroupPicker -> {
            BlockGroupPickerScreen(
                groups = sessionState.blockGroups,
                loading = sessionState.blockGroupsLoading,
                draftGroupId = pickerDraftGroupId,
                deviceAppCount = { group -> sessionViewModel.deviceAppsForGroup(group).size },
                errorMessage = sessionState.errorMessage,
                durationLabel = formatDurationPill(sessionState.hours, sessionState.minutes),
                onDraftSelect = { group -> pickerDraftGroupId = group.id },
                onEdit = { group -> openGroupEditor(group) },
                onDelete = { group -> sessionViewModel.deleteBlockGroup(group.id) },
                onCreate = { openGroupEditor(null) },
                onBack = {
                    pickerDraftGroupId?.let { sessionViewModel.selectBlockGroup(it) }
                    screen = BlockerFlowScreen.Duration
                }
            )
        }
        BlockerFlowScreen.GroupEditor -> {
            BlockGroupEditorScreen(
                isNewGroup = editingGroupId == null,
                name = editorName,
                entries = editorEntries,
                deviceAppCount = editorPackages.count { it in installedPackages },
                saving = sessionState.savingGroup,
                errorMessage = sessionState.errorMessage,
                onNameChange = {
                    editorName = it
                    sessionViewModel.clearError()
                },
                onAddEntry = { entry ->
                    if (entry.isNotBlank() && entry !in editorEntries) {
                        editorEntries = (editorEntries + entry).sorted()
                    }
                },
                onRemoveEntry = { entry -> editorEntries = editorEntries - entry },
                onChooseApps = { screen = BlockerFlowScreen.AppSelection },
                onSave = {
                    sessionViewModel.saveBlockGroup(
                        groupId = editingGroupId,
                        name = editorName,
                        packages = editorPackages.toList(),
                        domains = emptyList(),
                        targets = editorEntries,
                        onSaved = { screen = BlockerFlowScreen.GroupPicker }
                    )
                },
                onBack = { screen = BlockerFlowScreen.GroupPicker }
            )
        }
        BlockerFlowScreen.Groups -> {
            GroupsScreen(onBack = { screen = BlockerFlowScreen.Duration })
        }
        BlockerFlowScreen.Inbox -> {
            AccountabilityInboxScreen(onBack = { screen = BlockerFlowScreen.Duration })
        }
        BlockerFlowScreen.Duration -> {
            val completedSession = sessionState.lastCompletedSession
            if (completedSession != null) {
                SessionCompleteScreen(
                    session = completedSession,
                    onDone = sessionViewModel::clearCompletedSession
                )
            } else {
                DurationLockScreen(
                    blockGroupLabel = sessionState.selectedBlockGroup?.name,
                    hours = sessionState.hours,
                    minutes = sessionState.minutes,
                    seconds = sessionState.seconds,
                    sessionRunning = sessionState.sessionRunning,
                    isStartingSession = sessionState.isStartingSession,
                    remainingSeconds = sessionState.remainingSeconds,
                    errorMessage = sessionState.errorMessage,
                    onHoursChange = sessionViewModel::setHours,
                    onMinutesChange = sessionViewModel::setMinutes,
                    onSecondsChange = sessionViewModel::setSeconds,
                    onStartSession = {
                        if (!isAppBlockingServiceEnabled(context)) {
                            showAccessibilityPromptIfNeeded()
                        } else {
                            sessionViewModel.startSession()
                        }
                    },
                    onSelectApps = { screen = BlockerFlowScreen.GroupPicker },
                    onGroups = { screen = BlockerFlowScreen.Groups },
                    onNotifications = { screen = BlockerFlowScreen.Inbox },
                    accountabilityUnread = accountabilityUnread,
                    onSettings = { screen = BlockerFlowScreen.Settings },
                    onLogout = { sessionViewModel.stopSessionManually(onLogout) }
                )
            }
        }
    }

    if (showAccessibilityDialog) {
        AlertDialog(
            onDismissRequest = { showAccessibilityDialog = false },
            title = {
                Text(text = "Enable Accessibility")
            },
            text = {
                Text(
                    text = "Tether needs its accessibility service to detect when a selected app is opened. During an active session, it uses that access only to send blocked apps back to the home screen. Enable Tether in Accessibility settings, then return here and press Lock-In again."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showAccessibilityDialog = false
                        openAppBlockingSettings(context)
                    }
                ) {
                    Text(text = "OK")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showAccessibilityDialog = false }
                ) {
                    Text(text = "Cancel")
                }
            }
        )
    }
}

@Composable
private fun AppSelectionScreen(
    installedApps: List<InstalledApp>,
    selectedPackages: Set<String>,
    locked: Boolean,
    onTogglePackage: (String) -> Unit,
    onDone: () -> Unit
) {
    var query by remember { mutableStateOf("") }
    var showLockedWarning by remember { mutableStateOf(false) }
    var lockedWarningNonce by remember { mutableStateOf(0) }

    val selectedCount = selectedPackages.count { packageName ->
        installedApps.any { it.packageName == packageName }
    }
    val visibleApps = sortAppsForSelection(
        apps = filterApps(installedApps, query),
        selectedPackages = selectedPackages
    )

    LaunchedEffect(lockedWarningNonce) {
        if (lockedWarningNonce > 0) {
            showLockedWarning = true
            delay(2400)
            showLockedWarning = false
        }
    }

    Surface(modifier = Modifier.fillMaxSize(), color = Color.Black) {
        BoxWithConstraints(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            val contentHeight = maxHeight * 0.90f
            val contentWidth = (maxWidth * 0.84f).coerceAtMost(620.dp)
            val layout = remember(contentWidth, contentHeight) {
                BlockAppsLayoutMetrics(contentWidth, contentHeight)
            }

            Column(
                modifier = Modifier
                    .width(contentWidth)
                    .height(contentHeight),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                TopBar(layout = layout)

                Spacer(modifier = Modifier.height(layout.lockedWarningGap))

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(layout.lockedWarningHeight),
                    contentAlignment = Alignment.Center
                ) {
                    if (showLockedWarning) {
                        Text(
                            text = "Selected apps can't be modified when session is active",
                            color = Color.White,
                            fontSize = layout.lockedWarningTextSize.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(layout.lockedWarningRadius))
                                .background(Color(0xFFB42318))
                                .padding(
                                    horizontal = layout.lockedWarningHorizontalPadding,
                                    vertical = layout.lockedWarningVerticalPadding
                                )
                        )
                    }
                }

                Spacer(modifier = Modifier.height(layout.topBarToTitleGap))

                Text(
                    text = "Block Apps",
                    color = Color.White,
                    fontSize = layout.titleTextSize.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.sp,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(layout.titleToCountGap))

                Text(
                    text = "$selectedCount apps selected",
                    color = Color(0xFF92929A),
                    fontSize = layout.bodyTextSize.sp,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(layout.countToSearchGap))

                SearchField(
                    value = query,
                    layout = layout,
                    onValueChange = { query = it }
                )

                Spacer(modifier = Modifier.height(layout.searchToGridGap))

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                ) {
                    if (query.isNotBlank() && visibleApps.isEmpty()) {
                        Text(
                            text = "No apps found",
                            color = Color(0xFF92929A),
                            fontSize = (layout.bodyTextSize * 0.92f).sp,
                            modifier = Modifier.align(Alignment.TopStart)
                        )
                    } else {
                        LazyVerticalGrid(
                            columns = GridCells.Fixed(4),
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(bottom = layout.gridBottomPadding),
                            horizontalArrangement = Arrangement.spacedBy(layout.gridColumnGap),
                            verticalArrangement = Arrangement.spacedBy(layout.gridRowGap)
                        ) {
                            items(visibleApps, key = { it.packageName }) { app ->
                                val selected = app.packageName in selectedPackages
                                AppGridItem(
                                    app = app,
                                    selected = selected,
                                    layout = layout,
                                    onClick = {
                                        if (locked) {
                                            lockedWarningNonce += 1
                                        } else {
                                            onTogglePackage(app.packageName)
                                        }
                                    }
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(layout.gridToButtonGap))

                Button(
                    onClick = onDone,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(layout.startButtonHeight),
                    shape = RoundedCornerShape(layout.startButtonRadius),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF0A84FF),
                        contentColor = Color.White
                    )
                ) {
                    Text(
                        text = "Done · $selectedCount apps",
                        fontSize = layout.buttonTextSize.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun DurationLockScreen(
    blockGroupLabel: String?,
    hours: Int,
    minutes: Int,
    seconds: Int,
    sessionRunning: Boolean,
    isStartingSession: Boolean,
    remainingSeconds: Int,
    errorMessage: String?,
    onHoursChange: (Int) -> Unit,
    onMinutesChange: (Int) -> Unit,
    onSecondsChange: (Int) -> Unit,
    onStartSession: () -> Unit,
    onSelectApps: () -> Unit,
    onGroups: () -> Unit,
    onNotifications: () -> Unit,
    accountabilityUnread: Int,
    onSettings: () -> Unit,
    onLogout: () -> Unit
) {
    val selectedDurationSeconds = hours * 3600 + minutes * 60 + seconds
    val displaySeconds = if (sessionRunning) remainingSeconds else selectedDurationSeconds
    val displayHours = displaySeconds / 3600
    val displayMinutes = (displaySeconds % 3600) / 60
    val displaySecs = displaySeconds % 60

    Surface(modifier = Modifier.fillMaxSize(), color = Color.Black) {
        BoxWithConstraints(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            val contentHeight = maxHeight * 0.90f
            val contentWidth = (maxWidth * 0.84f).coerceAtMost(620.dp)
            val layout = remember(maxWidth, contentWidth, contentHeight) {
                DurationLockLayoutMetrics(
                    screenWidth = maxWidth,
                    contentWidth = contentWidth,
                    contentHeight = contentHeight
                )
            }

            Column(
                modifier = Modifier
                    .width(contentWidth)
                    .height(contentHeight),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    TextButton(onClick = onGroups) {
                        Text(
                            text = "Social",
                            color = Color(0xFF0A84FF),
                            fontSize = layout.logoutTextSize.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        TextButton(onClick = onSettings) {
                            Text(
                                text = "Settings",
                                color = Color(0xFF0A84FF),
                                fontSize = layout.logoutTextSize.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        TextButton(onClick = onLogout) {
                            Text(
                                text = "Log out",
                                color = Color(0xFF0A84FF),
                                fontSize = layout.logoutTextSize.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        NotificationBellButton(
                            unreadCount = accountabilityUnread,
                            onClick = onNotifications,
                            tint = Color(0xFF0A84FF)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(layout.topToTitleGap))

                Text(
                    text = "Tether",
                    color = Color.White,
                    fontSize = layout.titleTextSize.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(layout.titleToSubtitleGap))

                Text(
                    text = when {
                        sessionRunning -> "Session in progress"
                        isStartingSession -> "Starting session"
                        else -> "Set a session duration"
                    },
                    color = Color(0xFF8E8E96),
                    fontSize = layout.subtitleTextSize.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(layout.subtitleToPickerGap))

                DurationPicker(
                    hours = displayHours,
                    minutes = displayMinutes,
                    seconds = displaySecs,
                    locked = sessionRunning,
                    layout = layout,
                    onHoursChange = onHoursChange,
                    onMinutesChange = onMinutesChange,
                    onSecondsChange = onSecondsChange
                )

                Spacer(modifier = Modifier.weight(1f))

                AnimatedLockGraphic(
                    locked = sessionRunning,
                    layout = layout
                )

                Spacer(modifier = Modifier.height(layout.lockToReadyGap))

                SelectedBlockGroupButton(
                    blockGroupLabel = blockGroupLabel,
                    layout = layout,
                    onClick = onSelectApps
                )

                Spacer(modifier = Modifier.weight(1f))

                if (!errorMessage.isNullOrBlank()) {
                    Text(
                        text = errorMessage,
                        color = Color(0xFFFF453A),
                        fontSize = layout.errorTextSize.sp,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(layout.errorToButtonGap))
                }

                Button(
                    onClick = {
                        if (!sessionRunning && !isStartingSession) {
                            onStartSession()
                        }
                    },
                    enabled = !sessionRunning && !isStartingSession,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(layout.lockButtonHeight),
                    shape = RoundedCornerShape(layout.lockButtonRadius),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF1F1F22),
                        contentColor = Color.White,
                        disabledContainerColor = Color(0xFF1F1F22),
                        disabledContentColor = Color(0xFF6D6D73)
                    )
                ) {
                    Text(
                        text = when {
                            sessionRunning -> "Session Running"
                            isStartingSession -> "Starting..."
                            else -> "Lock-In!"
                        },
                        fontSize = layout.buttonTextSize.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun TopBar(layout: BlockAppsLayoutMetrics) {
    Box(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "5m",
            color = Color(0xFF8E8E96),
            fontSize = layout.navTextSize.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.align(Alignment.Center)
        )
    }
}

@Composable
private fun SearchField(
    value: String,
    layout: BlockAppsLayoutMetrics,
    onValueChange: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(layout.searchHeight)
            .clip(RoundedCornerShape(layout.searchRadius))
            .background(Color(0xFF1F1F22))
            .padding(horizontal = layout.searchHorizontalPadding),
        verticalAlignment = Alignment.CenterVertically
    ) {
        SearchIcon(size = layout.searchIconSize)

        Spacer(modifier = Modifier.width(layout.searchIconGap))

        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.weight(1f),
            singleLine = true,
            textStyle = TextStyle(
                color = Color.White,
                fontSize = layout.searchTextSize.sp
            ),
            decorationBox = { innerTextField ->
                if (value.isEmpty()) {
                    Text(
                        text = "Search",
                        color = Color(0xFF9B9BA3),
                        fontSize = layout.searchTextSize.sp
                    )
                }
                innerTextField()
            }
        )
    }
}

@Composable
private fun AppGridItem(
    app: InstalledApp,
    selected: Boolean,
    layout: BlockAppsLayoutMetrics,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(contentAlignment = Alignment.TopEnd) {
            Image(
                bitmap = app.icon.asImageBitmap(),
                contentDescription = app.label,
                modifier = Modifier
                    .size(layout.appIconSize)
                    .clip(RoundedCornerShape(layout.appIconRadius))
                    .graphicsLayer { alpha = if (selected) 1f else 0.45f },
                colorFilter = if (selected) null else grayscaleFilter()
            )

            if (selected) {
                Box(
                    modifier = Modifier
                        .size(layout.checkSize)
                        .clip(CircleShape)
                        .background(Color(0xFF0A84FF)),
                    contentAlignment = Alignment.Center
                ) {
                    CheckMark(size = layout.checkIconSize)
                }
            }
        }

        Spacer(modifier = Modifier.height(layout.appLabelGap))

        Text(
            text = app.label,
            color = if (selected) Color.White else Color(0xFF85858C),
            fontSize = layout.appLabelTextSize.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

private enum class DurationColumn {
    Hours,
    Minutes,
    Seconds
}

private fun parseColumnInput(raw: String, maxValue: Int): Pair<String, Int?> {
    val digits = raw.filter { it.isDigit() }.take(2)
    if (digits.isEmpty()) return "" to null
    val numeric = digits.toIntOrNull() ?: return digits to null
    if (numeric > maxValue) {
        return maxValue.toString() to maxValue
    }
    return digits to numeric
}

@Composable
private fun DurationPicker(
    hours: Int,
    minutes: Int,
    seconds: Int,
    locked: Boolean,
    layout: DurationLockLayoutMetrics,
    onHoursChange: (Int) -> Unit,
    onMinutesChange: (Int) -> Unit,
    onSecondsChange: (Int) -> Unit
) {
    var activeColumn by remember { mutableStateOf<DurationColumn?>(null) }

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .width(layout.pickerWidth)
                .height(layout.pickerHeight)
                .clip(RoundedCornerShape(layout.pickerRadius))
                .background(Color(0xFF1F1F22)),
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier
                    .align(Alignment.Center)
                    .fillMaxWidth()
                    .padding(horizontal = layout.pickerHorizontalPadding)
            ) {
                Box(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .fillMaxWidth()
                        .height(layout.pickerSelectedRowHeight)
                        .clip(RoundedCornerShape(layout.pickerSelectedRadius))
                        .background(Color(0xFF48484F))
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(layout.pickerWheelHeight),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    DurationWheel(
                        value = hours,
                        values = 0..23,
                        maxValue = 23,
                        locked = locked,
                        layout = layout,
                        isEditing = activeColumn == DurationColumn.Hours,
                        onActivate = {
                            if (!locked) activeColumn = DurationColumn.Hours
                        },
                        onScrollStarted = { activeColumn = null },
                        onValueChange = onHoursChange
                    )
                    DurationWheel(
                        value = minutes,
                        values = 0..59,
                        maxValue = 59,
                        locked = locked,
                        layout = layout,
                        isEditing = activeColumn == DurationColumn.Minutes,
                        onActivate = {
                            if (!locked) activeColumn = DurationColumn.Minutes
                        },
                        onScrollStarted = { activeColumn = null },
                        onValueChange = onMinutesChange
                    )
                    DurationWheel(
                        value = seconds,
                        values = 0..59,
                        maxValue = 59,
                        locked = locked,
                        layout = layout,
                        isEditing = activeColumn == DurationColumn.Seconds,
                        onActivate = {
                            if (!locked) activeColumn = DurationColumn.Seconds
                        },
                        onScrollStarted = { activeColumn = null },
                        onValueChange = onSecondsChange
                    )
                }

                Row(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .fillMaxWidth()
                        .height(layout.pickerSelectedRowHeight),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    FixedUnitLabel("hours", layout)
                    FixedUnitLabel("min", layout)
                    FixedUnitLabel("sec", layout)
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Tap a column to type",
            color = Color(0xFF8E8E96),
            fontSize = layout.errorTextSize.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.alpha(if (!locked && activeColumn == null) 1f else 0f)
        )
    }
}

@Composable
private fun DurationWheel(
    value: Int,
    values: IntRange,
    maxValue: Int,
    locked: Boolean,
    layout: DurationLockLayoutMetrics,
    isEditing: Boolean,
    onActivate: () -> Unit,
    onScrollStarted: () -> Unit,
    onValueChange: (Int) -> Unit
) {
    val cycleItems = remember(values) { values.toList() }
    val cycleSize = cycleItems.size
    val repeatCount = 51
    val middleCycle = repeatCount / 2
    val totalItems = cycleSize * repeatCount
    val initialIndex = middleCycle * cycleSize + cycleItems.indexOf(value).coerceAtLeast(0)
    val listState = rememberLazyListState(initialFirstVisibleItemIndex = initialIndex)
    val rowHeightPx = with(LocalDensity.current) { layout.pickerSelectedRowHeight.toPx() }
    val focusRequester = remember { FocusRequester() }
    var textFieldValue by remember { mutableStateOf(TextFieldValue("")) }
    var syncingScroll by remember { mutableStateOf(false) }
    var editFocusEstablished by remember { mutableStateOf(false) }
    var dismissingEdit by remember { mutableStateOf(false) }

    val selectedIndex by remember {
        derivedStateOf {
            listState.firstVisibleItemIndex +
                if (listState.firstVisibleItemScrollOffset > rowHeightPx * 0.5f) 1 else 0
        }
    }
    val selectedValue = cycleItems[((selectedIndex % cycleSize) + cycleSize) % cycleSize]

    fun dismissEdit() {
        if (dismissingEdit || !isEditing) return
        dismissingEdit = true
        val (_, parsed) = parseColumnInput(textFieldValue.text, maxValue)
        if (parsed != null) {
            onValueChange(parsed)
        }
        onScrollStarted()
    }

    LaunchedEffect(isEditing) {
        if (isEditing) {
            editFocusEstablished = false
            dismissingEdit = false
            val text = value.toString()
            textFieldValue = TextFieldValue(text, TextRange(0, text.length))
            focusRequester.requestFocus()
        } else {
            editFocusEstablished = false
            dismissingEdit = false
        }
    }

    LaunchedEffect(listState.isScrollInProgress, syncingScroll, isEditing) {
        if (isEditing && listState.isScrollInProgress && !syncingScroll) {
            dismissEdit()
        }
    }

    LaunchedEffect(selectedValue, isEditing, locked, syncingScroll) {
        if (!locked && !isEditing && !syncingScroll) {
            onValueChange(selectedValue)
        }
    }

    LaunchedEffect(listState.isScrollInProgress, selectedIndex, isEditing, syncingScroll) {
        if (locked || isEditing || syncingScroll || listState.isScrollInProgress) return@LaunchedEffect
        val lowerBound = cycleSize
        val upperBound = cycleSize * (repeatCount - 1)
        if (selectedIndex < lowerBound || selectedIndex >= upperBound) {
            val normalized = ((selectedIndex % cycleSize) + cycleSize) % cycleSize
            syncingScroll = true
            listState.scrollToItem(middleCycle * cycleSize + normalized)
            syncingScroll = false
        }
    }

    LaunchedEffect(value, locked) {
        val targetInCycle = cycleItems.indexOf(value).coerceAtLeast(0)
        val targetIndex = middleCycle * cycleSize + targetInCycle
        syncingScroll = true
        if (locked) {
            listState.animateScrollToItem(targetIndex)
        } else if (selectedValue != value) {
            listState.scrollToItem(targetIndex)
        }
        syncingScroll = false
    }

    Box(
        modifier = Modifier
            .width(layout.pickerColumnWidth)
            .height(layout.pickerWheelHeight)
    ) {
        LazyColumn(
            state = listState,
            flingBehavior = rememberSnapFlingBehavior(lazyListState = listState),
            userScrollEnabled = !locked && !isEditing,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(vertical = layout.pickerWheelVerticalPadding),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            items(totalItems) { index ->
                val item = cycleItems[index % cycleSize]
                val selected = item == selectedValue && !isEditing
                Box(
                    modifier = Modifier
                        .width(layout.pickerColumnWidth)
                        .height(layout.pickerSelectedRowHeight),
                    contentAlignment = Alignment.CenterStart
                ) {
                    Text(
                        text = item.toString().padStart(2, '0'),
                        color = if (selected || (isEditing && item == value)) {
                            Color.White
                        } else {
                            Color(0xFF5E5E66)
                        },
                        fontSize = if (selected || (isEditing && item == value)) {
                            layout.pickerValueTextSize.sp
                        } else {
                            layout.pickerMutedTextSize.sp
                        },
                        letterSpacing = 0.sp,
                        lineHeight = if (selected || (isEditing && item == value)) {
                            layout.pickerValueTextSize.sp
                        } else {
                            layout.pickerMutedTextSize.sp
                        },
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .width(layout.pickerNumberLaneWidth)
                            .alpha(if (isEditing && item == value) 0f else 1f)
                    )
                }
            }
        }

        if (!locked && !isEditing) {
            Box(
                modifier = Modifier
                    .align(Alignment.CenterStart)
                    .width(layout.pickerNumberTapWidth)
                    .height(layout.pickerSelectedRowHeight)
                    .clickable(onClick = onActivate)
            )
        }

        if (isEditing && !locked) {
            Box(
                modifier = Modifier
                    .align(Alignment.CenterStart)
                    .width(layout.pickerNumberTapWidth)
                    .height(layout.pickerSelectedRowHeight)
            ) {
                BasicTextField(
                    value = textFieldValue,
                    onValueChange = { raw ->
                        val (nextText, nextValue) = parseColumnInput(raw.text, maxValue)
                        textFieldValue = TextFieldValue(
                            text = nextText,
                            selection = TextRange(nextText.length)
                        )
                        if (nextValue != null) {
                            onValueChange(nextValue)
                        }
                    },
                    modifier = Modifier
                        .align(Alignment.CenterStart)
                        .width(layout.pickerNumberLaneWidth)
                        .height(layout.pickerSelectedRowHeight)
                        .focusRequester(focusRequester)
                        .onFocusChanged { state ->
                            if (state.isFocused) {
                                editFocusEstablished = true
                            } else if (editFocusEstablished) {
                                dismissEdit()
                            }
                        },
                    singleLine = true,
                    textStyle = TextStyle(
                        color = Color.White,
                        fontSize = layout.pickerValueTextSize.sp,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center
                    ),
                    cursorBrush = SolidColor(Color.White),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Number,
                        imeAction = ImeAction.Done
                    ),
                    keyboardActions = KeyboardActions(onDone = { dismissEdit() }),
                    decorationBox = { innerTextField ->
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            innerTextField()
                        }
                    }
                )
            }
        }
    }
}

@Composable
private fun FixedUnitLabel(label: String, layout: DurationLockLayoutMetrics) {
    Box(
        modifier = Modifier.width(layout.pickerColumnWidth),
        contentAlignment = Alignment.CenterStart
    ) {
        Text(
            text = label,
            color = Color(0xFFB0B0B8),
            fontSize = layout.pickerUnitTextSize.sp,
            lineHeight = layout.pickerUnitTextSize.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            modifier = Modifier.padding(start = layout.pickerLabelStart)
        )
    }
}

@Composable
private fun AnimatedLockGraphic(
    locked: Boolean,
    layout: DurationLockLayoutMetrics
) {
    val lockProgress by animateFloatAsState(
        targetValue = if (locked) 1f else 0f,
        animationSpec = tween(durationMillis = 650),
        label = "lockProgress"
    )
    val lockColor by animateColorAsState(
        targetValue = if (locked) Color(0xFFFF453A) else Color(0xFF30D158),
        animationSpec = tween(durationMillis = 650),
        label = "lockColor"
    )

    Canvas(modifier = Modifier.size(layout.lockGraphicSize)) {
        val w = size.width
        val h = size.height
        val stroke = w * layout.lockStrokeRatio
        val bodyLeft = w * layout.lockBodyLeftRatio
        val bodyTop = h * layout.lockBodyTopRatio
        val bodyWidth = w * layout.lockBodyWidthRatio
        val bodyHeight = h * layout.lockBodyHeightRatio
        val shackleLeft = w * layout.lockClosedShackleLeftRatio
        val shackleTop = h * layout.lockClosedShackleTopRatio
        val shackleWidth = w * layout.lockClosedShackleWidthRatio
        val shackleHeight = h * layout.lockClosedShackleHeightRatio
        val shackleRotation = lerp(layout.lockOpenShackleRotationDegrees, 0f, lockProgress)
        val shacklePivot = androidx.compose.ui.geometry.Offset(
            shackleLeft + shackleWidth,
            shackleTop + (shackleHeight / 2f)
        )

        rotate(degrees = shackleRotation, pivot = shacklePivot) {
            drawArc(
                color = lockColor,
                startAngle = layout.lockClosedShackleStartAngle,
                sweepAngle = layout.lockClosedShackleSweepAngle,
                useCenter = false,
                topLeft = androidx.compose.ui.geometry.Offset(shackleLeft, shackleTop),
                size = androidx.compose.ui.geometry.Size(shackleWidth, shackleHeight),
                style = androidx.compose.ui.graphics.drawscope.Stroke(width = stroke, cap = StrokeCap.Round)
            )
        }
        drawRoundRect(
            color = lockColor,
            topLeft = androidx.compose.ui.geometry.Offset(bodyLeft, bodyTop),
            size = androidx.compose.ui.geometry.Size(bodyWidth, bodyHeight),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(w * 0.09f, w * 0.09f)
        )
        drawCircle(
            color = Color.Black,
            radius = w * 0.07f,
            center = androidx.compose.ui.geometry.Offset(bodyLeft + bodyWidth * 0.50f, bodyTop + bodyHeight * 0.38f)
        )
        val keyhole = Path().apply {
            moveTo(bodyLeft + bodyWidth * 0.44f, bodyTop + bodyHeight * 0.45f)
            lineTo(bodyLeft + bodyWidth * 0.56f, bodyTop + bodyHeight * 0.45f)
            lineTo(bodyLeft + bodyWidth * 0.62f, bodyTop + bodyHeight * 0.78f)
            lineTo(bodyLeft + bodyWidth * 0.38f, bodyTop + bodyHeight * 0.78f)
            close()
        }
        drawPath(keyhole, Color.Black)
    }
}

@Composable
private fun SelectedBlockGroupButton(
    blockGroupLabel: String?,
    layout: DurationLockLayoutMetrics,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(layout.readyPillRadius))
            .background(Color(0xFF1F1F22))
            .clickable(onClick = onClick)
            .padding(horizontal = layout.readyPillHorizontalPadding, vertical = layout.readyPillVerticalPadding),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(layout.readyDotSize)
                .clip(CircleShape)
                .background(Color(0xFF0A84FF))
        )
        Spacer(modifier = Modifier.width(layout.readyDotGap))
        Text(
            text = blockGroupLabel?.let { "Block group · $it" } ?: "Choose a block group",
            color = Color.White,
            fontSize = layout.readyTextSize.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

private fun filterApps(apps: List<InstalledApp>, query: String): List<InstalledApp> {
    val normalizedQuery = query.trim().lowercase()
    if (normalizedQuery.isEmpty()) return apps

    return apps
        .map { app ->
            val label = app.label.lowercase()
            val packageName = app.packageName.lowercase()
            val compactLabel = label.filterNot(Char::isWhitespace)
            val compactQuery = normalizedQuery.filterNot(Char::isWhitespace)
            val score = when {
                label == normalizedQuery -> 0
                label.startsWith(normalizedQuery) -> 1
                compactLabel.startsWith(compactQuery) -> 2
                label.contains(normalizedQuery) -> 3
                compactLabel.contains(compactQuery) -> 4
                packageName.contains(normalizedQuery) -> 5
                else -> 100
            }
            app to score
        }
        .filter { (_, score) -> score < 100 }
        .sortedWith(compareBy({ it.second }, { it.first.label.lowercase() }))
        .map { it.first }
}

private fun sortAppsForSelection(
    apps: List<InstalledApp>,
    selectedPackages: Set<String>
): List<InstalledApp> {
    return apps.sortedWith(
        compareByDescending<InstalledApp> { it.packageName in selectedPackages }
            .thenBy { it.label.lowercase() }
    )
}

private fun formatDurationCountdown(totalSeconds: Int): String {
    val clamped = totalSeconds.coerceAtLeast(0)
    val hours = clamped / 3600
    val minutes = (clamped % 3600) / 60
    val seconds = clamped % 60
    return "${hours.twoDigits()}:${minutes.twoDigits()}:${seconds.twoDigits()}"
}

private fun Int.twoDigits(): String = toString().padStart(2, '0')

private fun lerp(start: Float, stop: Float, fraction: Float): Float {
    return start + (stop - start) * fraction
}

private fun grayscaleFilter(): ColorFilter {
    val matrix = ColorMatrix(
        floatArrayOf(
            0.2126f, 0.7152f, 0.0722f, 0f, 0f,
            0.2126f, 0.7152f, 0.0722f, 0f, 0f,
            0.2126f, 0.7152f, 0.0722f, 0f, 0f,
            0f, 0f, 0f, 1f, 0f
        )
    )
    return ColorFilter.colorMatrix(matrix)
}

@Composable
private fun BackChevron(size: Dp) {
    Canvas(modifier = Modifier.size(size)) {
        val strokeWidth = size.toPx() * 0.13f
        drawLine(
            color = Color(0xFF0A84FF),
            start = androidx.compose.ui.geometry.Offset(this.size.width * 0.65f, this.size.height * 0.18f),
            end = androidx.compose.ui.geometry.Offset(this.size.width * 0.30f, this.size.height * 0.50f),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Round
        )
        drawLine(
            color = Color(0xFF0A84FF),
            start = androidx.compose.ui.geometry.Offset(this.size.width * 0.30f, this.size.height * 0.50f),
            end = androidx.compose.ui.geometry.Offset(this.size.width * 0.65f, this.size.height * 0.82f),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Round
        )
    }
}

@Composable
private fun SearchIcon(size: Dp) {
    Canvas(modifier = Modifier.size(size)) {
        val strokeWidth = size.toPx() * 0.12f
        drawCircle(
            color = Color(0xFF9B9BA3),
            radius = this.size.minDimension * 0.28f,
            center = androidx.compose.ui.geometry.Offset(this.size.width * 0.43f, this.size.height * 0.43f),
            style = androidx.compose.ui.graphics.drawscope.Stroke(width = strokeWidth)
        )
        drawLine(
            color = Color(0xFF9B9BA3),
            start = androidx.compose.ui.geometry.Offset(this.size.width * 0.63f, this.size.height * 0.63f),
            end = androidx.compose.ui.geometry.Offset(this.size.width * 0.84f, this.size.height * 0.84f),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Round
        )
    }
}

@Composable
private fun CheckMark(size: Dp) {
    Canvas(modifier = Modifier.size(size)) {
        val strokeWidth = size.toPx() * 0.18f
        drawLine(
            color = Color.White,
            start = androidx.compose.ui.geometry.Offset(this.size.width * 0.18f, this.size.height * 0.48f),
            end = androidx.compose.ui.geometry.Offset(this.size.width * 0.42f, this.size.height * 0.72f),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Round
        )
        drawLine(
            color = Color.White,
            start = androidx.compose.ui.geometry.Offset(this.size.width * 0.42f, this.size.height * 0.72f),
            end = androidx.compose.ui.geometry.Offset(this.size.width * 0.84f, this.size.height * 0.28f),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Round
        )
    }
}

private data class BlockAppsLayoutMetrics(
    val titleTextSize: Float,
    val bodyTextSize: Float,
    val navTextSize: Float,
    val buttonTextSize: Float,
    val searchTextSize: Float,
    val appLabelTextSize: Float,
    val lockedWarningTextSize: Float,
    val topIconSize: Dp,
    val lockedWarningGap: Dp,
    val lockedWarningHeight: Dp,
    val lockedWarningRadius: Dp,
    val lockedWarningHorizontalPadding: Dp,
    val lockedWarningVerticalPadding: Dp,
    val topBarToTitleGap: Dp,
    val titleToCountGap: Dp,
    val countToSearchGap: Dp,
    val searchToGridGap: Dp,
    val searchHeight: Dp,
    val searchRadius: Dp,
    val searchHorizontalPadding: Dp,
    val searchIconSize: Dp,
    val searchIconGap: Dp,
    val appIconSize: Dp,
    val appIconRadius: Dp,
    val checkSize: Dp,
    val checkIconSize: Dp,
    val appLabelGap: Dp,
    val gridColumnGap: Dp,
    val gridRowGap: Dp,
    val gridBottomPadding: Dp,
    val gridToButtonGap: Dp,
    val startButtonHeight: Dp,
    val startButtonRadius: Dp
) {
    companion object {
        operator fun invoke(contentWidth: Dp, contentHeight: Dp): BlockAppsLayoutMetrics {
            val widthScale = contentWidth.value / 328f
            val heightScale = contentHeight.value / 760f
            val scale = max(0.64f, minOf(widthScale, heightScale, 1f))

            return BlockAppsLayoutMetrics(
                titleTextSize = 40f * scale,
                bodyTextSize = 22f * scale,
                navTextSize = 20f * scale,
                buttonTextSize = 22f * scale,
                searchTextSize = 24f * scale,
                appLabelTextSize = 15f * scale,
                lockedWarningTextSize = 13f * scale,
                topIconSize = (30f * scale).dp,
                lockedWarningGap = (12f * scale).dp,
                lockedWarningHeight = (48f * scale).dp,
                lockedWarningRadius = (12f * scale).dp,
                lockedWarningHorizontalPadding = (12f * scale).dp,
                lockedWarningVerticalPadding = (10f * scale).dp,
                topBarToTitleGap = (20f * scale).dp,
                titleToCountGap = (10f * scale).dp,
                countToSearchGap = (26f * scale).dp,
                searchToGridGap = (30f * scale).dp,
                searchHeight = (64f * scale).dp,
                searchRadius = (18f * scale).dp,
                searchHorizontalPadding = (18f * scale).dp,
                searchIconSize = (26f * scale).dp,
                searchIconGap = (10f * scale).dp,
                appIconSize = (74f * scale).dp,
                appIconRadius = (16f * scale).dp,
                checkSize = (24f * scale).dp,
                checkIconSize = (17f * scale).dp,
                appLabelGap = (8f * scale).dp,
                gridColumnGap = (24f * scale).dp,
                gridRowGap = (28f * scale).dp,
                gridBottomPadding = (10f * scale).dp,
                gridToButtonGap = (18f * scale).dp,
                startButtonHeight = (70f * scale).dp,
                startButtonRadius = (16f * scale).dp
            )
        }
    }
}

private data class DurationLockLayoutMetrics(
    val titleTextSize: Float,
    val subtitleTextSize: Float,
    val buttonTextSize: Float,
    val logoutTextSize: Float,
    val errorTextSize: Float,
    val backIconSize: Dp,
    val topToTitleGap: Dp,
    val titleToSubtitleGap: Dp,
    val subtitleToPickerGap: Dp,
    val pickerWidth: Dp,
    val pickerHeight: Dp,
    val pickerRadius: Dp,
    val pickerHorizontalPadding: Dp,
    val pickerSelectedHorizontalPadding: Dp,
    val pickerSelectedRowHeight: Dp,
    val pickerSelectedRadius: Dp,
    val pickerWheelHeight: Dp,
    val pickerColumnWidth: Dp,
    val pickerNumberLaneWidth: Dp,
    val pickerNumberTapPadding: Dp,
    val pickerNumberTapWidth: Dp,
    val pickerLabelStart: Dp,
    val pickerWheelVerticalPadding: Dp,
    val pickerValueTextSize: Float,
    val pickerUnitTextSize: Float,
    val pickerMutedTextSize: Float,
    val lockGraphicSize: Dp,
    val lockStrokeRatio: Float,
    val lockBodyLeftRatio: Float,
    val lockBodyTopRatio: Float,
    val lockBodyWidthRatio: Float,
    val lockBodyHeightRatio: Float,
    val lockShackleLeftRatio: Float,
    val lockShackleTopRatio: Float,
    val lockShackleWidthRatio: Float,
    val lockShackleHeightRatio: Float,
    val lockShackleStartAngle: Float,
    val lockShackleSweepAngle: Float,
    val lockOpenShackleRotationDegrees: Float,
    val lockClosedShackleLeftRatio: Float,
    val lockClosedShackleTopRatio: Float,
    val lockClosedShackleWidthRatio: Float,
    val lockClosedShackleHeightRatio: Float,
    val lockClosedShackleStartAngle: Float,
    val lockClosedShackleSweepAngle: Float,
    val lockToReadyGap: Dp,
    val readyTextSize: Float,
    val readyPillRadius: Dp,
    val readyPillHorizontalPadding: Dp,
    val readyPillVerticalPadding: Dp,
    val readyDotSize: Dp,
    val readyDotGap: Dp,
    val errorToButtonGap: Dp,
    val lockButtonHeight: Dp,
    val lockButtonRadius: Dp
) {
    companion object {
        operator fun invoke(screenWidth: Dp, contentWidth: Dp, contentHeight: Dp): DurationLockLayoutMetrics {
            val widthScale = contentWidth.value / 328f
            val heightScale = contentHeight.value / 760f
            val scale = max(0.64f, minOf(widthScale, heightScale, 1f))
            val pickerWidth = screenWidth * 0.90f
            val pickerHorizontalPadding = pickerWidth * 0.045f
            val pickerInnerWidth = pickerWidth - (pickerHorizontalPadding * 2f)
            val pickerColumnWidth = pickerInnerWidth / 3f
            val pickerNumberLaneWidth = pickerColumnWidth * 0.44f
            val pickerNumberTapPadding = (pickerColumnWidth * 0.08f).coerceIn(6.dp, 12.dp)
            val pickerNumberTapWidth = pickerNumberLaneWidth + (pickerNumberTapPadding * 2f)

            return DurationLockLayoutMetrics(
                titleTextSize = 46f * scale,
                subtitleTextSize = 22f * scale,
                buttonTextSize = 22f * scale,
                logoutTextSize = 17f * scale,
                errorTextSize = 13f * scale,
                backIconSize = (28f * scale).dp,
                topToTitleGap = (54f * scale).dp,
                titleToSubtitleGap = (18f * scale).dp,
                subtitleToPickerGap = (40f * scale).dp,
                pickerWidth = pickerWidth,
                pickerHeight = (pickerWidth * 0.46f).coerceIn(154.dp, 210.dp),
                pickerRadius = (22f * scale).dp,
                pickerHorizontalPadding = pickerHorizontalPadding,
                pickerSelectedHorizontalPadding = pickerHorizontalPadding,
                pickerSelectedRowHeight = (pickerWidth * 0.145f).coerceIn(50.dp, 68.dp),
                pickerSelectedRadius = (12f * scale).dp,
                pickerWheelHeight = (pickerWidth * 0.435f).coerceIn(150.dp, 204.dp),
                pickerColumnWidth = pickerColumnWidth,
                pickerNumberLaneWidth = pickerNumberLaneWidth,
                pickerNumberTapPadding = pickerNumberTapPadding,
                pickerNumberTapWidth = pickerNumberTapWidth,
                pickerLabelStart = pickerNumberLaneWidth + (pickerColumnWidth * 0.02f),
                pickerWheelVerticalPadding = (pickerWidth * 0.145f).coerceIn(50.dp, 68.dp),
                pickerValueTextSize = (pickerWidth.value * 0.082f).coerceIn(27f, 38f),
                pickerUnitTextSize = (pickerWidth.value * 0.043f).coerceIn(14f, 20f),
                pickerMutedTextSize = (pickerWidth.value * 0.078f).coerceIn(26f, 36f),
                lockGraphicSize = (screenWidth * 0.34f).coerceIn(126.dp, 172.dp),
                lockStrokeRatio = 0.095f,
                lockBodyLeftRatio = 0.22f,
                lockBodyTopRatio = 0.44f,
                lockBodyWidthRatio = 0.64f,
                lockBodyHeightRatio = 0.42f,
                lockShackleLeftRatio = 0.27f,
                lockShackleTopRatio = 0.11f,
                lockShackleWidthRatio = 0.42f,
                lockShackleHeightRatio = 0.47f,
                lockShackleStartAngle = 188f,
                lockShackleSweepAngle = 205f,
                lockOpenShackleRotationDegrees = 42f,
                lockClosedShackleLeftRatio = 0.30f,
                lockClosedShackleTopRatio = 0.19f,
                lockClosedShackleWidthRatio = 0.46f,
                lockClosedShackleHeightRatio = 0.50f,
                lockClosedShackleStartAngle = 180f,
                lockClosedShackleSweepAngle = 180f,
                lockToReadyGap = (26f * scale).dp,
                readyTextSize = 17f * scale,
                readyPillRadius = (18f * scale).dp,
                readyPillHorizontalPadding = (18f * scale).dp,
                readyPillVerticalPadding = (8f * scale).dp,
                readyDotSize = (8f * scale).dp,
                readyDotGap = (10f * scale).dp,
                errorToButtonGap = (10f * scale).dp,
                lockButtonHeight = (70f * scale).dp,
                lockButtonRadius = (16f * scale).dp
            )
        }
    }
}

private enum class BlockerFlowScreen {
    AppSelection,
    GroupPicker,
    GroupEditor,
    Groups,
    Inbox,
    Settings,
    Duration
}

@Preview(showBackground = true)
@Composable
fun BlockerSetupPreview() {
    MyApplicationTheme {
        BlockerSetupScreen()
    }
}
