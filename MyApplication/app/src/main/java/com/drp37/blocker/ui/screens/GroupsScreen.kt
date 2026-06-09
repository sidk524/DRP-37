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
import com.drp37.blocker.remote.webserver.GroupSummary
import com.drp37.blocker.remote.webserver.LeaderboardEntry
import com.drp37.blocker.remote.webserver.WebServerService
import kotlinx.coroutines.launch

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
            return
        }
        coroutineScope.launch {
            runCatching { WebServerService.getGroupLeaderboard(groupId) }
                .onSuccess { leaderboard = it }
                .onFailure { throwable ->
                    error = throwable.message ?: "Could not load leaderboard."
                }
        }
    }

    LaunchedEffect(Unit) {
        refreshGroups(null)
    }

    LaunchedEffect(selectedGroupId) {
        refreshLeaderboard(selectedGroupId)
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
                Text(text = "Groups", color = Color(0xFF8E8E96), fontSize = 16.sp)
                Spacer(modifier = Modifier.weight(1f))
                Box(modifier = Modifier)
            }
            Spacer(modifier = Modifier.height(18.dp))
            Text(text = "Leaderboards", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Bold)
            Text(
                text = "Join friends and compare completed focus time.",
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
            if (loading) {
                Text(text = "Loading groups...", color = Color(0xFF8E8E96))
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
                    items(leaderboard, key = { it.userId }) { entry ->
                        LeaderboardRow(entry = entry)
                    }
                }
            }
        }
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
private fun LeaderboardRow(entry: LeaderboardEntry) {
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
            Text(text = formatLockedTime(entry.lockedSeconds), color = Color(0xFF8E8E96), fontSize = 13.sp)
        }
        if (entry.isCurrentUser) {
            Text(text = "You", color = Color(0xFF0A84FF), fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

private fun formatLockedTime(seconds: Int): String {
    val hours = seconds / 3600
    val minutes = (seconds % 3600) / 60
    return when {
        hours > 0 -> "${hours}h ${minutes}m locked"
        else -> "${minutes}m locked"
    }
}
