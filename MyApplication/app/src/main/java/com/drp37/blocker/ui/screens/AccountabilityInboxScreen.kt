package com.drp37.blocker.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drp37.blocker.remote.webserver.AccountabilityInboxItem
import com.drp37.blocker.remote.webserver.SessionSyncClient
import com.drp37.blocker.remote.webserver.WebServerService
import kotlinx.coroutines.launch

@Composable
fun AccountabilityInboxScreen(onBack: () -> Unit) {
    val coroutineScope = rememberCoroutineScope()
    var inbox by remember { mutableStateOf<List<AccountabilityInboxItem>>(emptyList()) }
    var unreadCount by remember { mutableStateOf(0) }
    var messageDrafts by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var error by remember { mutableStateOf<String?>(null) }

    fun refreshInbox() {
        coroutineScope.launch {
            runCatching { WebServerService.getAccountabilityInbox() }
                .onSuccess {
                    inbox = it.first
                    unreadCount = it.second
                }
                .onFailure { throwable ->
                    error = throwable.message ?: "Could not load notifications."
                }
        }
    }

    LaunchedEffect(Unit) {
        refreshInbox()
        SessionSyncClient.unreadCount.collect { count ->
            unreadCount = count
            refreshInbox()
        }
    }

    fun markRead(item: AccountabilityInboxItem) {
        if (!item.unread) return
        coroutineScope.launch {
            runCatching {
                if (item.kind == "attempt") {
                    WebServerService.markAccountabilityNotificationRead(item.id)
                } else {
                    WebServerService.markAccountabilityMessageRead(item.id)
                }
            }.onSuccess {
                inbox = inbox.map { if (it.id == item.id) it.copy(unread = false) else it }
                unreadCount = (unreadCount - 1).coerceAtLeast(0)
            }
        }
    }

    fun clearAll() {
        coroutineScope.launch {
            runCatching { WebServerService.clearAccountabilityInbox() }
                .onSuccess {
                    inbox = emptyList()
                    messageDrafts = emptyMap()
                    unreadCount = 0
                }
                .onFailure { throwable ->
                    error = throwable.message ?: "Could not clear notifications."
                }
        }
    }

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
                if (inbox.isNotEmpty()) {
                    TextButton(onClick = ::clearAll) {
                        Text(text = "Clear all", color = Color(0xFF0A84FF))
                    }
                }
            }
            Spacer(modifier = Modifier.height(18.dp))
            Text(text = "Notifications", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Bold)
            if (!error.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = error.orEmpty(), color = Color(0xFFFF453A), fontSize = 14.sp)
            }
            Spacer(modifier = Modifier.height(16.dp))
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.weight(1f)) {
                if (inbox.isEmpty()) {
                    item { Text(text = "No accountability notifications yet.", color = Color(0xFF8E8E96)) }
                }
                items(inbox, key = { "${it.kind}-${it.id}" }) { item ->
                    AccountabilityInboxCard(
                        item = item,
                        draft = messageDrafts[item.attemptId].orEmpty(),
                        onDraftChange = { value -> messageDrafts = messageDrafts + (item.attemptId to value.take(280)) },
                        onOpen = { markRead(item) },
                        onPreset = { key ->
                            coroutineScope.launch {
                                runCatching { WebServerService.sendAccountabilityPreset(item.attemptId, key) }
                            }
                        },
                        onSend = {
                            val body = messageDrafts[item.attemptId].orEmpty().trim()
                            if (body.isNotEmpty()) {
                                coroutineScope.launch {
                                    runCatching { WebServerService.sendAccountabilityMessage(item.attemptId, body) }
                                    messageDrafts = messageDrafts - item.attemptId
                                }
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun AccountabilityInboxCard(
    item: AccountabilityInboxItem,
    draft: String,
    onDraftChange: (String) -> Unit,
    onOpen: () -> Unit,
    onPreset: (String) -> Unit,
    onSend: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0xFF1F1F22))
            .clickable(onClick = onOpen)
            .padding(14.dp)
    ) {
        if (item.unread) {
            Text(text = "New", color = Color(0xFF0A84FF), fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(4.dp))
        }
        if (item.kind == "message") {
            Text(text = "Encouragement", color = Color(0xFF8E8E96), fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(4.dp))
        }
        Text(text = item.title, color = Color.White, fontWeight = FontWeight.Bold)
        Text(text = item.detail, color = Color(0xFF8E8E96))
        if (item.kind == "attempt") {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("lock_in" to "Lock in", "stay_focused" to "Stay focused", "youve_got_this" to "You've got this").forEach { (key, label) ->
                    TextButton(onClick = { onPreset(key) }) {
                        Text(label)
                    }
                }
            }
            OutlinedTextField(
                value = draft,
                onValueChange = onDraftChange,
                label = { Text("Private message") },
                modifier = Modifier.fillMaxWidth()
            )
            TextButton(onClick = onSend) { Text("Send") }
        }
    }
}
