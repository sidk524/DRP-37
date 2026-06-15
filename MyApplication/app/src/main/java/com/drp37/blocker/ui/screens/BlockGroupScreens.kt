package com.drp37.blocker.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drp37.blocker.remote.webserver.BlockGroup
import com.drp37.blocker.ui.theme.TetherColors
import com.drp37.blocker.ui.theme.TetherDimens
import com.drp37.blocker.ui.theme.TetherShapes

@Composable
private fun BlockGroupScaffold(
    title: String,
    onBack: () -> Unit,
    errorMessage: String?,
    durationLabel: String? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    Surface(modifier = Modifier.fillMaxSize(), color = TetherColors.Background) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .drawBehind {
                    drawRect(
                        brush = Brush.radialGradient(
                            colors = listOf(
                                Color(0x1F0A84FF),
                                Color.Transparent
                            ),
                            center = Offset(size.width / 2f, 0f),
                            radius = size.width * 0.9f
                        )
                    )
                }
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(
                        horizontal = TetherDimens.FramePaddingHorizontal,
                        vertical = TetherDimens.FramePaddingVertical
                    )
            ) {
                BlockGroupTopBar(onBack = onBack, durationLabel = durationLabel)

                Spacer(modifier = Modifier.height(TetherDimens.SectionGap))

                Text(
                    text = title,
                    color = TetherColors.TextPrimary,
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.5).sp
                )

                if (!errorMessage.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = errorMessage,
                        color = TetherColors.Danger,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(TetherDimens.SectionGap))

                content()
            }
        }
    }
}

@Composable
private fun BlockGroupTopBar(
    onBack: () -> Unit,
    durationLabel: String?
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            modifier = Modifier
                .weight(1f)
                .clickable(onClick = onBack),
            verticalAlignment = Alignment.CenterVertically
        ) {
            BackChevron()
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = "Back",
                color = TetherColors.Accent,
                fontSize = 17.sp,
                fontWeight = FontWeight.Medium
            )
        }

        if (durationLabel != null) {
            Text(
                text = durationLabel,
                color = TetherColors.TextSecondary,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier
                    .clip(TetherShapes.Pill)
                    .background(TetherColors.Surface)
                    .padding(horizontal = 14.dp, vertical = 6.dp)
            )
        } else {
            Spacer(modifier = Modifier.weight(1f))
        }

        Spacer(modifier = Modifier.weight(1f))
    }
}

@Composable
private fun BackChevron() {
    Box(
        modifier = Modifier.size(width = 8.dp, height = 14.dp),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val stroke = 2.4.dp.toPx()
            val color = TetherColors.Accent
            drawLine(
                color = color,
                start = Offset(size.width * 0.65f, size.height * 0.12f),
                end = Offset(size.width * 0.15f, size.height * 0.5f),
                strokeWidth = stroke,
                cap = StrokeCap.Round
            )
            drawLine(
                color = color,
                start = Offset(size.width * 0.15f, size.height * 0.5f),
                end = Offset(size.width * 0.65f, size.height * 0.88f),
                strokeWidth = stroke,
                cap = StrokeCap.Round
            )
        }
    }
}

@Composable
private fun BlockGroupListCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .fillMaxHeight()
            .clip(TetherShapes.Lg)
            .background(TetherColors.Surface)
            .border(1.dp, TetherColors.Border, TetherShapes.Lg)
            .padding(TetherDimens.CardPadding),
        verticalArrangement = Arrangement.spacedBy(TetherDimens.ListGap),
        content = content
    )
}

@Composable
private fun BlockGroupPickerRow(
    name: String,
    meta: String,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    onEdit: () -> Unit,
    onDelete: (() -> Unit)?
) {
    val background = if (selected) TetherColors.AccentSoft else TetherColors.RowFill
    val borderColor = if (selected) TetherColors.Accent else TetherColors.Border

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = TetherDimens.ControlHeightSm)
            .clip(TetherShapes.Default)
            .background(background)
            .border(
                width = 1.dp,
                color = borderColor,
                shape = TetherShapes.Default
            )
            .then(
                if (selected) {
                    Modifier.border(1.dp, TetherColors.AccentRing, TetherShapes.Default)
                } else {
                    Modifier
                }
            )
            .padding(start = 16.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            modifier = Modifier
                .weight(1f)
                .clickable(enabled = enabled, onClick = onClick)
                .padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .clip(CircleShape)
                    .background(if (selected) TetherColors.Accent else TetherColors.DotInactive)
                    .then(
                        if (selected) {
                            Modifier.drawBehind {
                                drawCircle(
                                    color = Color(0xCC0A84FF),
                                    radius = size.width * 1.6f
                                )
                            }
                        } else {
                            Modifier
                        }
                    )
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = name,
                    color = TetherColors.TextPrimary,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = meta,
                    color = TetherColors.TextSecondary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            TextButton(onClick = onEdit) {
                Text(
                    text = "Edit",
                    color = TetherColors.Accent,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp
                )
            }
            if (onDelete != null) {
                TextButton(onClick = onDelete) {
                    Text(
                        text = "Delete",
                        color = TetherColors.Danger,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun TetherSecondaryButton(
    text: String,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .height(TetherDimens.ControlHeight),
        shape = TetherShapes.Lg,
        colors = ButtonDefaults.buttonColors(
            containerColor = TetherColors.Surface,
            contentColor = TetherColors.TextPrimary
        ),
        border = BorderStroke(1.dp, TetherColors.Border)
    ) {
        Text(text = text, fontSize = 17.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun TetherPrimaryButton(
    text: String,
    enabled: Boolean = true,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier
            .fillMaxWidth()
            .height(TetherDimens.ControlHeight),
        shape = TetherShapes.Lg,
        colors = ButtonDefaults.buttonColors(
            containerColor = TetherColors.Accent,
            contentColor = TetherColors.TextPrimary,
            disabledContainerColor = TetherColors.SurfaceBtn,
            disabledContentColor = TetherColors.TextTertiary
        )
    ) {
        Text(text = text, fontSize = 17.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun BlockGroupListPlaceholder(text: String) {
    Text(
        text = text,
        color = TetherColors.TextSecondary,
        fontSize = 15.sp,
        textAlign = TextAlign.Center,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 24.dp)
    )
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
            .height(TetherDimens.ControlHeightSm)
            .clip(TetherShapes.Default)
            .background(TetherColors.InputSurface)
            .border(1.dp, TetherColors.Border, TetherShapes.Default)
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.weight(1f),
            singleLine = true,
            textStyle = TextStyle(color = TetherColors.TextPrimary, fontSize = 16.sp),
            decorationBox = { innerTextField ->
                if (value.isEmpty()) {
                    Text(text = placeholder, color = TetherColors.TextSecondary, fontSize = 16.sp)
                }
                innerTextField()
            }
        )
        if (value.isNotBlank()) {
            TextButton(onClick = onSubmit) {
                Text(text = "Add", color = TetherColors.Accent, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
fun BlockGroupPickerScreen(
    groups: List<BlockGroup>,
    loading: Boolean,
    draftGroupId: String?,
    deviceAppCount: (BlockGroup) -> Int,
    errorMessage: String?,
    durationLabel: String,
    onDraftSelect: (BlockGroup) -> Unit,
    onEdit: (BlockGroup) -> Unit,
    onDelete: (BlockGroup) -> Unit,
    onCreate: () -> Unit,
    onBack: () -> Unit
) {
    BlockGroupScaffold(
        title = "Choose a block group",
        onBack = onBack,
        errorMessage = errorMessage,
        durationLabel = durationLabel
    ) {
        BlockGroupListCard(modifier = Modifier.weight(1f)) {
            when {
                loading && groups.isEmpty() -> BlockGroupListPlaceholder("Loading block groups…")
                groups.isEmpty() -> BlockGroupListPlaceholder("No block groups yet")
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(TetherDimens.ListGap)
                    ) {
                        items(groups, key = { it.id }) { group ->
                            val selected = group.id == draftGroupId
                            val appCount = deviceAppCount(group)
                            BlockGroupPickerRow(
                                name = group.name,
                                meta = blockGroupSummary(appCount, group.expandedDomainsBlocked.size),
                                selected = selected,
                                enabled = true,
                                onClick = { onDraftSelect(group) },
                                onEdit = { onEdit(group) },
                                onDelete = if (group.systemKey == null) {
                                    { onDelete(group) }
                                } else {
                                    null
                                }
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        TetherPrimaryButton(text = "New block group", onClick = onCreate)
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
                .height(TetherDimens.ControlHeightSm)
                .clip(TetherShapes.Default)
                .background(TetherColors.InputSurface)
                .border(1.dp, TetherColors.Border, TetherShapes.Default)
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            BasicTextField(
                value = name,
                onValueChange = onNameChange,
                modifier = Modifier.weight(1f),
                singleLine = true,
                textStyle = TextStyle(color = TetherColors.TextPrimary, fontSize = 16.sp),
                decorationBox = { innerTextField ->
                    if (name.isEmpty()) {
                        Text(text = "Group name", color = TetherColors.TextSecondary, fontSize = 16.sp)
                    }
                    innerTextField()
                }
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        TetherSecondaryButton(
            text = "Choose apps · $deviceAppCount on this device",
            onClick = onChooseApps
        )

        Spacer(modifier = Modifier.height(18.dp))

        Text(
            text = "Websites (blocks on desktop)",
            color = TetherColors.TextSecondary,
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
                item {
                    Text(
                        text = "No websites added yet",
                        color = TetherColors.TextSecondary,
                        fontSize = 14.sp
                    )
                }
            } else {
                items(entries, key = { it }) { entry ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(TetherShapes.Sm)
                            .background(TetherColors.RowFill)
                            .border(1.dp, TetherColors.Border, TetherShapes.Sm)
                            .padding(start = 14.dp, end = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = entry,
                            color = TetherColors.TextPrimary,
                            fontSize = 15.sp,
                            modifier = Modifier.weight(1f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        TextButton(onClick = { onRemoveEntry(entry) }) {
                            Text(text = "Remove", color = TetherColors.Danger, fontSize = 13.sp)
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        TetherPrimaryButton(
            text = if (saving) "Saving…" else "Save group",
            enabled = !saving,
            onClick = onSave
        )
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
