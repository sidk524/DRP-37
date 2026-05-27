package com.drp37.blocker.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

@Composable
fun LockSessionDialog(
    durationMinutes: Int,
    onStop: () -> Unit
) {
    var secondsLeft by remember(durationMinutes) { mutableIntStateOf(durationMinutes * 60) }
    val isLocked = secondsLeft > 0
    val accent = if (isLocked) Color(0xFFD93B3B) else Color(0xFF2EAD55)

    LaunchedEffect(durationMinutes) {
        while (secondsLeft > 0) {
            delay(1000)
            secondsLeft -= 1
        }
    }

    AlertDialog(
        onDismissRequest = {},
        title = null,
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(2.dp, accent, RoundedCornerShape(18.dp))
                    .background(Color.White, RoundedCornerShape(18.dp))
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = formatCountdown(secondsLeft),
                    color = Color.Black,
                    fontSize = 34.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(26.dp))

                Box(
                    modifier = Modifier.size(116.dp),
                    contentAlignment = Alignment.Center
                ) {
                    LockIcon(color = accent, locked = isLocked)
                }

                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = if (isLocked) "Locked" else "Unlocked",
                    color = accent,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = if (isLocked) {
                        "Selected apps are in a blocking session."
                    } else {
                        "The blocking session has finished."
                    },
                    color = Color(0xFF666666),
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onStop,
                colors = ButtonDefaults.buttonColors(containerColor = accent)
            ) {
                Text(if (isLocked) "Stop" else "Done")
            }
        },
        containerColor = Color.Transparent
    )
}

@Composable
private fun LockIcon(color: Color, locked: Boolean) {
    Canvas(modifier = Modifier.size(110.dp)) {
        val stroke = Stroke(width = 9.dp.toPx(), cap = StrokeCap.Round)
        val bodyTop = size.height * 0.45f
        val bodyLeft = size.width * 0.24f
        val bodySize = Size(size.width * 0.52f, size.height * 0.42f)

        drawRoundRect(
            color = color,
            topLeft = Offset(bodyLeft, bodyTop),
            size = bodySize,
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(9.dp.toPx(), 9.dp.toPx()),
            style = stroke
        )

        val shackleLeft = size.width * if (locked) 0.31f else 0.39f
        val shackleTop = size.height * 0.17f
        drawArc(
            color = color,
            startAngle = 180f,
            sweepAngle = if (locked) 180f else 140f,
            useCenter = false,
            topLeft = Offset(shackleLeft, shackleTop),
            size = Size(size.width * 0.38f, size.height * 0.5f),
            style = stroke
        )

        drawLine(
            color = color,
            start = Offset(size.width * 0.5f, size.height * 0.6f),
            end = Offset(size.width * 0.5f, size.height * 0.73f),
            strokeWidth = 7.dp.toPx(),
            cap = StrokeCap.Round
        )
    }
}

private fun formatCountdown(totalSeconds: Int): String {
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return "%02d:%02d:%02d".format(hours, minutes, seconds)
}
