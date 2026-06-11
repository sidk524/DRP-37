package com.drp37.blocker.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drp37.blocker.remote.webserver.BlockGroup

private val ScreenBackground = Color.Black
private val CardBackground = Color(0xFF1F1F22)
private val AccentBlue = Color(0xFF0A84FF)
private val MutedText = Color(0xFF8E8E96)
private val ErrorRed = Color(0xFFFF453A)

@Composable
private fun BlockGroupScaffold(
    title: String,
    onBack: () -> Unit,
    errorMessage: String?,
    content: @Composable ColumnScope.() -> Unit
) {
    Surface(modifier = Modifier.fillMaxSize(), color = ScreenBackground) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp, vertical = 32.dp)
        ) {
            Box(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "Back",
                    color = AccentBlue,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .align(Alignment.CenterStart)
                        .clickable(onClick = onBack)
                )
            }

            Spacer(modifier = Modifier.height(22.dp))

            Text(
                text = title,
                color = Color.White,
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold
            )

            if (!errorMessage.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = errorMessage,
                    color = ErrorRed,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(modifier = Modifier.height(18.dp))

            content()
        }
    }
}

@Composable
private fun EditorField(
    value: String,
    placeholder: String,
    onValueChange: (String) -> Unit,
    onSubmit: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(54.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(CardBackground)
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.weight(1f),
            singleLine = true,
            textStyle = TextStyle(color = Color.White, fontSize = 16.sp),
            decorationBox = { innerTextField ->
                if (value.isEmpty()) {
                    Text(text = placeholder, color = MutedText, fontSize = 16.sp)
                }
                innerTextField()
            }
        )
        if (value.isNotBlank()) {
            TextButton(onClick = onSubmit) {
                Text(text = "Add", color = AccentBlue, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
fun BlockGroupPickerScreen(
    groups: List<BlockGroup>,
    loading: Boolean,
    selectedGroupId: String?,
    deviceAppCount: (BlockGroup) -> Int,
    errorMessage: String?,
    onSelect: (BlockGroup) -> Unit,
    onManageGroups: () -> Unit,
    onBack: () -> Unit
) {
    BlockGroupScaffold(title = "Choose a block group", onBack = onBack, errorMessage = errorMessage) {
        if (loading && groups.isEmpty()) {
            Text(
                text = "Loading block groups…",
                color = MutedText,
                fontSize = 15.sp,
                modifier = Modifier.weight(1f)
            )
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(groups, key = { it.id }) { group ->
                    val selected = group.id == selectedGroupId
                    val appCount = deviceAppCount(group)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(CardBackground)
                            .clickable { onSelect(group) }
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .clip(CircleShape)
                                .background(if (selected) AccentBlue else Color(0xFF48484F))
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = group.name,
                                color = Color.White,
                                fontSize = 17.sp,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = blockGroupSummary(appCount, group.expandedDomainsBlocked.size),
                                color = MutedText,
                                fontSize = 13.sp
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        Button(
            onClick = onManageGroups,
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = CardBackground,
                contentColor = Color.White
            )
        ) {
            Text(text = "Manage groups", fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun BlockGroupManagerScreen(
    groups: List<BlockGroup>,
    errorMessage: String?,
    onEdit: (BlockGroup) -> Unit,
    onDelete: (BlockGroup) -> Unit,
    onCreate: () -> Unit,
    onBack: () -> Unit
) {
    BlockGroupScaffold(title = "Manage block groups", onBack = onBack, errorMessage = errorMessage) {
        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(groups, key = { it.id }) { group ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(CardBackground)
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = group.name,
                            color = Color.White,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        if (group.systemKey != null) {
                            Text(text = "Default group", color = MutedText, fontSize = 12.sp)
                        }
                    }
                    TextButton(onClick = { onEdit(group) }) {
                        Text(text = "Edit", color = AccentBlue, fontWeight = FontWeight.SemiBold)
                    }
                    if (group.systemKey == null) {
                        TextButton(onClick = { onDelete(group) }) {
                            Text(text = "Delete", color = ErrorRed, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        Button(
            onClick = onCreate,
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = AccentBlue,
                contentColor = Color.White
            )
        ) {
            Text(text = "New block group", fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun BlockGroupEditorScreen(
    isNewGroup: Boolean,
    name: String,
    entries: List<String>,
    deviceAppCount: Int,
    saving: Boolean,
    errorMessage: String?,
    onNameChange: (String) -> Unit,
    onAddEntry: (String) -> Unit,
    onRemoveEntry: (String) -> Unit,
    onChooseApps: () -> Unit,
    onSave: () -> Unit,
    onBack: () -> Unit
) {
    var domainInput by remember { mutableStateOf("") }

    fun submitDomain() {
        val normalized = domainInput.trim().lowercase()
            .removePrefix("https://")
            .removePrefix("http://")
            .substringBefore("/")
        if (normalized.contains(".")) {
            onAddEntry(normalized)
            domainInput = ""
        }
    }

    BlockGroupScaffold(
        title = if (isNewGroup) "New block group" else "Edit block group",
        onBack = onBack,
        errorMessage = errorMessage
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(CardBackground)
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            BasicTextField(
                value = name,
                onValueChange = onNameChange,
                modifier = Modifier.weight(1f),
                singleLine = true,
                textStyle = TextStyle(color = Color.White, fontSize = 16.sp),
                decorationBox = { innerTextField ->
                    if (name.isEmpty()) {
                        Text(text = "Group name", color = MutedText, fontSize = 16.sp)
                    }
                    innerTextField()
                }
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        Button(
            onClick = onChooseApps,
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = CardBackground,
                contentColor = Color.White
            )
        ) {
            Text(
                text = "Choose apps · $deviceAppCount on this device",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(modifier = Modifier.height(18.dp))

        Text(
            text = "Websites (blocks on desktop)",
            color = MutedText,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold
        )

        Spacer(modifier = Modifier.height(8.dp))

        EditorField(
            value = domainInput,
            placeholder = "e.g. instagram.com",
            onValueChange = { domainInput = it },
            onSubmit = { submitDomain() }
        )

        Spacer(modifier = Modifier.height(10.dp))

        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (entries.isEmpty()) {
                items(listOf("empty")) {
                    Text(
                        text = "No websites added yet",
                        color = MutedText,
                        fontSize = 14.sp
                    )
                }
            } else {
                items(entries, key = { it }) { entry ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(CardBackground)
                            .padding(horizontal = 14.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = entry,
                            color = Color.White,
                            fontSize = 15.sp,
                            modifier = Modifier.weight(1f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        TextButton(onClick = { onRemoveEntry(entry) }) {
                            Text(text = "Remove", color = ErrorRed, fontSize = 13.sp)
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        Button(
            onClick = onSave,
            enabled = !saving,
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = AccentBlue,
                contentColor = Color.White,
                disabledContainerColor = CardBackground,
                disabledContentColor = MutedText
            )
        ) {
            Text(
                text = if (saving) "Saving…" else "Save group",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

private fun blockGroupSummary(appCount: Int, siteCount: Int): String {
    return buildString {
        append("$appCount app")
        if (appCount != 1) append("s")
        append(" on this device")
        if (siteCount > 0) {
            append(" · $siteCount site")
            if (siteCount != 1) append("s")
            append(" on desktop")
        }
    }
}
