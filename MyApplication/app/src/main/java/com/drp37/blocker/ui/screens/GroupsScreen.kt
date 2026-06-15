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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drp37.blocker.accountability.AccountabilityAlerts
import com.drp37.blocker.remote.webserver.AccountabilityInboxItem
import com.drp37.blocker.remote.webserver.GroupPresence
import com.drp37.blocker.remote.webserver.GroupSummary
import com.drp37.blocker.remote.webserver.LeaderboardEntry
import com.drp37.blocker.remote.webserver.SessionSyncClient
import com.drp37.blocker.remote.webserver.WebServerService
import com.drp37.blocker.ui.components.NotificationBellButton
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay

private enum class LeaderboardMetric {
    Time,
    Points
}

@Composable
fun GroupsScreen(onBack: () -> Unit) {
    val coroutineScope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    var groups by remember { mutableStateOf<List<GroupSummary>>(emptyList()) }
    var leaderboard by remember { mutableStateOf<List<LeaderboardEntry>>(emptyList()) }
    var selectedGroupId by remember { mutableStateOf<String?>(null) }
    var newGroupName by remember { mutableStateOf("") }
    var inviteCode by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var leaderboardMetric by remember { mutableStateOf(LeaderboardMetric.Time) }
    var focusPointsAvailable by remember { mutableStateOf(true) }
    var presence by remember { mutableStateOf<List<GroupPresence>>(emptyList()) }
    var inbox by remember { mutableStateOf<List<AccountabilityInboxItem>>(emptyList()) }
    var unreadCount by remember { mutableStateOf(0) }
    var showInbox by remember { mutableStateOf(false) }
    var messageDrafts by remember { mutableStateOf<Map<String, String>>(emptyMap()) }

    val rankedLeaderboard = remember(leaderboard, leaderboardMetric) {
        rankLeaderboard(leaderboard, leaderboardMetric)
    }
    val presenceByUserId = remember(presence) {
        presence.associateBy { it.userId }
    }

    fun refreshGroups(preferredGroupId: String? = selectedGroupId) {
        coroutineScope.launch {
            loading = true
            error = null
            runCatching { WebServerService.listGroups() }
                .onSuccess { nextGroups ->
                    groups = nextGroups
                    selectedGroupId = preferredGroupId?.takeIf { id -> nextGroups.any { it.id == id } }
                        ?: nextGroups.firstOrNull()?.id
                }
                .onFailure { throwable ->
                    error = throwable.message ?: "Could not load groups."
                }
            loading = false
        }
    }

    fun refreshLeaderboard(groupId: String?) {
        if (groupId == null) {
            leaderboard = emptyList()
            focusPointsAvailable = true
            return
        }
        coroutineScope.launch {
            runCatching { WebServerService.getGroupLeaderboard(groupId) }
                .onSuccess { result ->
                    leaderboard = result.entries
                    focusPointsAvailable = result.focusPointsAvailable
                    if (!result.focusPointsAvailable && leaderboardMetric == LeaderboardMetric.Points) {
                        leaderboardMetric = LeaderboardMetric.Time
                    }
                }
                .onFailure { throwable ->
                    error = throwable.message ?: "Could not load leaderboard."
                }
        }
    }

    LaunchedEffect(Unit) {
        refreshGroups(null)
        runCatching { WebServerService.getAccountabilityInbox() }.onSuccess {
            inbox = it.first
            unreadCount = it.second
        }
    }

    LaunchedEffect(Unit) {
        SessionSyncClient.unreadCount.collect { count ->
            unreadCount = count
            if (showInbox) {
                runCatching { WebServerService.getAccountabilityInbox() }.onSuccess {
                    inbox = it.first
                    unreadCount = it.second
                }
            }
        }
    }

    LaunchedEffect(selectedGroupId, groups) {
        refreshLeaderboard(selectedGroupId)
        val group = groups.firstOrNull { it.id == selectedGroupId }
        if (group == null || group.isDefault) {
            presence = emptyList()
        } else {
            while (true) {
                presence = runCatching { WebServerService.getGroupPresence(group.id) }.getOrDefault(emptyList())
                delay(15_000)
            }
        }
    }

    val selectedGroup = groups.firstOrNull { it.id == selectedGroupId }

    Surface(modifier = Modifier.fillMaxSize(), color = Color.Black) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = onBack) {
                    Text(text = "Back", color = Color(0xFF0A84FF))
                }
                Spacer(modifier = Modifier.weight(1f))
                Text(text = "Social", color = Color(0xFF8E8E96), fontSize = 16.sp)
                Spacer(modifier = Modifier.weight(1f))
                NotificationBellButton(
                    unreadCount = unreadCount,
                    onClick = { showInbox = !showInbox }
                )
            }
            if (showInbox) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "Notifications", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    if (inbox.isNotEmpty()) {
                        TextButton(onClick = {
                            coroutineScope.launch {
                                runCatching { WebServerService.clearAccountabilityInbox() }
                                    .onSuccess {
                                        inbox = emptyList()
                                        messageDrafts = emptyMap()
                                        unreadCount = 0
                                    }
                            }
                        }) {
                            Text(text = "Clear all", color = Color(0xFF0A84FF))
                        }
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
            }
            Spacer(modifier = Modifier.height(18.dp))
            Text(text = "Leaderboards", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Bold)
            Text(
                text = "Compare locked-in time or focus points from completed sessions.",
                color = Color(0xFF8E8E96),
                fontSize = 16.sp,
                modifier = Modifier.padding(top = 8.dp, bottom = 16.dp)
            )
            if (!error.isNullOrBlank()) {
                Text(text = error.orEmpty(), color = Color(0xFFFF453A), fontSize = 14.sp)
                Spacer(modifier = Modifier.height(10.dp))
            }
            GroupInputRow(
                value = newGroupName,
                placeholder = "New group name",
                buttonText = "Create",
                onValueChange = { newGroupName = it },
                onSubmit = {
                    val name = newGroupName.trim()
                    if (name.isBlank()) return@GroupInputRow
                    coroutineScope.launch {
                        runCatching { WebServerService.createGroup(name) }
                            .onSuccess { group ->
                                newGroupName = ""
                                refreshGroups(group.id)
                            }
                            .onFailure { throwable ->
                                error = throwable.message ?: "Could not create group."
                            }
                    }
                }
            )
            Spacer(modifier = Modifier.height(10.dp))
            GroupInputRow(
                value = inviteCode,
                placeholder = "Invite code",
                buttonText = "Join",
                onValueChange = { inviteCode = it.uppercase() },
                onSubmit = {
                    val code = inviteCode.trim()
                    if (code.isBlank()) return@GroupInputRow
                    coroutineScope.launch {
                        runCatching { WebServerService.joinGroup(code) }
                            .onSuccess { group ->
                                inviteCode = ""
                                refreshGroups(group.id)
                            }
                            .onFailure { throwable ->
                                error = throwable.message ?: "Could not join group."
                            }
                    }
                }
            )
            Spacer(modifier = Modifier.height(16.dp))
            if (showInbox) {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.weight(1f)) {
                    if (inbox.isEmpty()) item { Text(text = "No accountability notifications yet.", color = Color(0xFF8E8E96)) }
                    items(inbox, key = { "${it.kind}-${it.id}" }) { item ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color(0xFF1F1F22))
                                .clickable {
                                    if (item.unread) {
                                        coroutineScope.launch {
                                            runCatching {
                                                if (item.kind == "attempt") {
                                                    WebServerService.markAccountabilityNotificationRead(item.id)
                                                } else {
                                                    WebServerService.markAccountabilityMessageRead(item.id)
                                                }
                                            }
                                            inbox = inbox.map { if (it.id == item.id) it.copy(unread = false) else it }
                                            unreadCount = (unreadCount - 1).coerceAtLeast(0)
                                        }
                                    }
                                }
                                .padding(14.dp)
                        ) {
                            if (item.unread) {
                                Text(text = "New", color = Color(0xFF0A84FF), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                            if (item.kind == "message") {
                                Text(text = "Encouragement", color = Color(0xFF8E8E96), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                            Text(text = item.title, color = Color.White, fontWeight = FontWeight.Bold)
                            Text(text = item.detail, color = Color(0xFF8E8E96))
                            if (item.kind == "attempt") {
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    listOf("lock_in" to "Lock in", "stay_focused" to "Stay focused", "youve_got_this" to "You've got this").forEach { (key, label) ->
                                        TextButton(onClick = {
                                            coroutineScope.launch {
                                                runCatching { WebServerService.sendAccountabilityPreset(item.attemptId, key) }
                                                    .onSuccess {
                                                        AccountabilityAlerts.clearAttemptAfterReply(item.attemptId, item.id)
                                                        inbox = inbox.filter { it.id != item.id }
                                                        if (item.unread) unreadCount = (unreadCount - 1).coerceAtLeast(0)
                                                    }
                                            }
                                        }) {
                                            Text(label)
                                        }
                                    }
                                }
                                OutlinedTextField(
                                    value = messageDrafts[item.attemptId].orEmpty(),
                                    onValueChange = { value -> messageDrafts = messageDrafts + (item.attemptId to value.take(280)) },
                                    label = { Text("Private message") },
                                    modifier = Modifier.fillMaxWidth()
                                )
                                TextButton(onClick = {
                                    val body = messageDrafts[item.attemptId].orEmpty().trim()
                                    if (body.isNotEmpty()) coroutineScope.launch {
                                        runCatching { WebServerService.sendAccountabilityMessage(item.attemptId, body) }
                                            .onSuccess {
                                                AccountabilityAlerts.clearAttemptAfterReply(item.attemptId, item.id)
                                                messageDrafts = messageDrafts - item.attemptId
                                                inbox = inbox.filter { it.id != item.id }
                                                if (item.unread) unreadCount = (unreadCount - 1).coerceAtLeast(0)
                                            }
                                    }
                                }) { Text("Send") }
                            }
                        }
                    }
                }
                return@Column
            }
            if (loading) {
                Text(text = "Loading social...", color = Color(0xFF8E8E96))
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            groups.forEach { group ->
                                GroupChip(
                                    group = group,
                                    selected = group.id == selectedGroupId,
                                    onClick = { selectedGroupId = group.id }
                                )
                            }
                        }
                    }
                    item {
                        if (selectedGroup != null) {
                            InviteCard(
                                group = selectedGroup,
                                onCopy = { clipboard.setText(AnnotatedString(selectedGroup.inviteCode)) }
                            )
                        }
                    }
                    item {
                        LeaderboardMetricToggle(
                            metric = leaderboardMetric,
                            focusPointsAvailable = focusPointsAvailable,
                            onMetricChange = { leaderboardMetric = it }
                        )
                    }
                    if (!focusPointsAvailable) {
                        item {
                            Text(
                                text = "Points ranking is unavailable until the focus_session_points database table is set up.",
                                color = Color(0xFF8E8E96),
                                fontSize = 14.sp
                            )
                        }
                    }
                    if (rankedLeaderboard.isEmpty()) {
                        item {
                            Text(
                                text = if (selectedGroup == null) {
                                    "Select or create a group to see the leaderboard."
                                } else {
                                    "No completed sessions yet."
                                },
                                color = Color(0xFF8E8E96),
                                fontSize = 14.sp
                            )
                        }
                    } else {
                        items(rankedLeaderboard, key = { it.userId }) { entry ->
                            LeaderboardRow(
                                entry = entry,
                                metric = leaderboardMetric,
                                sessionLabel = presenceByUserId[entry.userId]?.let { member ->
                                    formatSessionLabel(member)
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LeaderboardMetricToggle(
    metric: LeaderboardMetric,
    focusPointsAvailable: Boolean,
    onMetricChange: (LeaderboardMetric) -> Unit
) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0xFF111114))
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        LeaderboardMetricChip(
            label = "Time",
            selected = metric == LeaderboardMetric.Time,
            enabled = true,
            onClick = { onMetricChange(LeaderboardMetric.Time) }
        )
        LeaderboardMetricChip(
            label = "Points",
            selected = metric == LeaderboardMetric.Points,
            enabled = focusPointsAvailable,
            onClick = { onMetricChange(LeaderboardMetric.Points) }
        )
    }
}

@Composable
private fun LeaderboardMetricChip(
    label: String,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(if (selected) Color(0xFF0A84FF) else Color.Transparent)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp)
    ) {
        Text(
            text = label,
            color = when {
                !enabled -> Color(0xFF5F5F65)
                selected -> Color.White
                else -> Color(0xFF8E8E96)
            },
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun GroupInputRow(
    value: String,
    placeholder: String,
    buttonText: String,
    onValueChange: (String) -> Unit,
    onSubmit: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.weight(1f),
            singleLine = true,
            placeholder = { Text(text = placeholder) }
        )
        Button(
            onClick = onSubmit,
            modifier = Modifier.width(92.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF0A84FF),
                contentColor = Color.White
            )
        ) {
            Text(text = buttonText, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun GroupChip(
    group: GroupSummary,
    selected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(14.dp))
            .background(if (selected) Color(0xFF0A84FF) else Color(0xFF1F1F22))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 9.dp)
    ) {
        Text(
            text = group.name,
            color = Color.White,
            fontSize = 13.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun InviteCard(
    group: GroupSummary,
    onCopy: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(Color(0xFF111114))
            .padding(16.dp)
    ) {
        Text(text = group.name, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(6.dp))
        Text(text = "${group.memberCount} members", color = Color(0xFF8E8E96), fontSize = 14.sp)
        Spacer(modifier = Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(text = "Invite: ${group.inviteCode}", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            Spacer(modifier = Modifier.weight(1f))
            TextButton(onClick = onCopy) {
                Text(text = "Copy", color = Color(0xFF0A84FF))
            }
        }
    }
}

@Composable
private fun LeaderboardRow(
    entry: LeaderboardEntry,
    metric: LeaderboardMetric,
    sessionLabel: String? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(if (entry.isCurrentUser) Color(0x1F4A9EFF) else Color(0xFF1F1F22))
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = "#${entry.rank}", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.padding(horizontal = 8.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(text = entry.displayName, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
            if (!sessionLabel.isNullOrBlank()) {
                Text(
                    text = sessionLabel,
                    color = Color(0xFF8E8E96),
                    fontSize = 13.sp
                )
            }
        }
        Text(
            text = formatLeaderboardScore(entry, metric),
            color = Color.White,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold
        )
        if (entry.isCurrentUser) {
            Spacer(modifier = Modifier.padding(horizontal = 8.dp))
            Text(text = "You", color = Color(0xFF0A84FF), fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

private fun rankLeaderboard(
    entries: List<LeaderboardEntry>,
    metric: LeaderboardMetric
): List<LeaderboardEntry> {
    return entries
        .sortedWith(
            compareByDescending<LeaderboardEntry> { entry ->
                when (metric) {
                    LeaderboardMetric.Time -> entry.lockedSeconds
                    LeaderboardMetric.Points -> entry.focusPoints
                }
            }.thenBy { it.displayName }
        )
        .mapIndexed { index, entry -> entry.copy(rank = index + 1) }
}

private fun formatLeaderboardScore(entry: LeaderboardEntry, metric: LeaderboardMetric): String {
    return when (metric) {
        LeaderboardMetric.Time -> formatLockedTime(entry.lockedSeconds)
        LeaderboardMetric.Points -> {
            val points = entry.focusPoints.coerceAtLeast(0)
            if (points == 1) "1 pt" else "$points pts"
        }
    }
}

private fun formatLockedTime(seconds: Int): String {
    val hours = seconds / 3600
    val minutes = (seconds % 3600) / 60
    val remainingSeconds = seconds % 60
    return when {
        hours > 0 && minutes > 0 -> "${hours}h ${minutes}m"
        hours > 0 -> "${hours}h"
        minutes > 0 -> "${minutes}m"
        else -> "${remainingSeconds}s"
    }
}

private fun formatSessionLabel(member: GroupPresence): String? {
    if (!member.active) return null
    val endsAt = member.endsAt ?: return null
    val remainingSeconds = runCatching {
        val endEpoch = java.time.Instant.parse(endsAt).epochSecond
        (endEpoch - java.time.Instant.now().epochSecond).toInt()
    }.getOrDefault(0)
    if (remainingSeconds <= 0) return null
    return "In session · ${formatLockedTime(remainingSeconds)} left"
}
