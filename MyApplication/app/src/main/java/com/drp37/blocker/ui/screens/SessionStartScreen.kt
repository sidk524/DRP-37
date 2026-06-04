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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drp37.blocker.model.BlockList
import com.drp37.blocker.ui.components.DurationScrollPicker
import com.drp37.blocker.ui.theme.MyApplicationTheme
import kotlin.math.max

private val Bg = Color(0xFF0D0D0F)
private val SurfaceColor = Color(0xFF1F1F22)
private val Border = Color(0xFF2A2D35)
private val Accent = Color(0xFF0A84FF)
private val Subtle = Color(0xFF8F8F95)

private data class SessionModeOption(
    val id: String,
    val label: String,
    val hint: String,
)

private val SessionModes = listOf(
    SessionModeOption("breathing", "Breathing", "Pause, then through"),
    SessionModeOption("reflect", "Reflect", "Purpose + your note"),
    SessionModeOption("hard", "Hard block", "No way through"),
)

@Composable
fun SessionStartScreen(
    blockList: BlockList,
    accountLabel: String,
    onBlockListChange: (BlockList) -> Unit,
    onSelectApps: () -> Unit,
    onLockIn: () -> Unit,
    onSignOut: () -> Unit,
) {
    val selectedCount = blockList.packages.size
    val canLockIn = selectedCount > 0

    Surface(modifier = Modifier.fillMaxSize(), color = Bg) {
        BoxWithConstraints(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            val contentWidth = (maxWidth * 0.9f).coerceAtMost(560.dp)
            val pickerWidth = maxWidth.coerceAtMost(620.dp)

            Column(
                modifier = Modifier
                    .width(contentWidth)
                    .padding(horizontal = 24.dp, vertical = 40.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = accountLabel,
                        color = Subtle,
                        fontSize = 15.sp,
                    )
                    TextButton(onClick = onSignOut) {
                        Text("Sign out", color = Accent, fontSize = 15.sp)
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))

                Text(
                    text = "Start session",
                    color = Color.White,
                    fontSize = 36.sp,
                    fontWeight = FontWeight.Bold,
                )

                Text(
                    text = "Set your focus time, pick apps, then lock in.",
                    color = Subtle,
                    fontSize = 16.sp,
                    modifier = Modifier.padding(top = 8.dp, bottom = 28.dp),
                )

                SectionLabel("Duration")
                DurationScrollPicker(
                    durationMinutes = blockList.durationMinutes,
                    onDurationChange = { minutes ->
                        onBlockListChange(blockList.copy(durationMinutes = minutes))
                    },
                    screenWidth = pickerWidth,
                )

                Spacer(modifier = Modifier.height(24.dp))

                SectionLabel("Mode")
                ModeGrid(
                    selected = blockList.mode,
                    onSelect = { mode ->
                        onBlockListChange(blockList.copy(mode = mode))
                    },
                )

                Spacer(modifier = Modifier.height(24.dp))

                SectionLabel("Apps")
                SelectAppsCard(
                    selectedCount = selectedCount,
                    onClick = onSelectApps,
                )

                Spacer(modifier = Modifier.height(28.dp))

                Button(
                    onClick = onLockIn,
                    enabled = canLockIn,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Accent,
                        disabledContainerColor = Color(0xFF323232),
                        contentColor = Color.White,
                        disabledContentColor = Subtle,
                    ),
                ) {
                    Text(
                        text = if (canLockIn) "Lock in · $selectedCount apps" else "Select apps to lock in",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        color = Subtle,
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 1.sp,
        modifier = Modifier.padding(bottom = 12.dp),
    )
}

@Composable
private fun ModeGrid(
    selected: String,
    onSelect: (String) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        SessionModes.forEach { mode ->
            val isOn = selected == mode.id
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (isOn) Color(0xFF16222E) else SurfaceColor)
                    .border(
                        width = 1.dp,
                        color = if (isOn) Accent else Border,
                        shape = RoundedCornerShape(12.dp),
                    )
                    .clickable { onSelect(mode.id) }
                    .padding(horizontal = 10.dp, vertical = 14.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = mode.label,
                    color = if (isOn) Color.White else Subtle,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
                Text(
                    text = mode.hint,
                    color = Subtle,
                    fontSize = 11.sp,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun SelectAppsCard(
    selectedCount: Int,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(SurfaceColor)
            .border(1.dp, Border, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Select apps to block",
                color = Color.White,
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = if (selectedCount == 0) {
                    "No apps selected yet"
                } else {
                    "$selectedCount app${if (selectedCount == 1) "" else "s"} selected"
                },
                color = Subtle,
                fontSize = 14.sp,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        Text(
            text = "›",
            color = Accent,
            fontSize = 28.sp,
            fontWeight = FontWeight.Light,
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun SessionStartScreenPreview() {
    MyApplicationTheme {
        SessionStartScreen(
            blockList = BlockList(packages = setOf("com.example"), durationMinutes = 30, mode = "breathing"),
            accountLabel = "you@example.com",
            onBlockListChange = {},
            onSelectApps = {},
            onLockIn = {},
            onSignOut = {},
        )
    }
}
