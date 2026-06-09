package com.drp37.blocker.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drp37.blocker.remote.webserver.FocusPointsRecord

@Composable
fun SessionCompleteScreen(
    session: FocusPointsRecord,
    onDone: () -> Unit
) {
    val minutes = session.actualMs / 60000
    val seconds = (session.actualMs % 60000) / 1000
    val modeMultiplier = when (session.mode) {
        "hard" -> "2.5x"
        "reflect" -> "1.5x"
        else -> "1x"
    }
    val appsMultiplier = "1 + ${(session.blockedAppsCount - 1).coerceAtLeast(0)} extra"

    Surface(modifier = Modifier.fillMaxSize(), color = Color.Black) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(28.dp))
                    .background(Color(0xFF111114))
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(text = "Session Complete!", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = "Well done. You stayed focused.",
                    color = Color(0xFF8E8E96),
                    fontSize = 16.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(26.dp))
                Text(text = session.points.toString(), color = Color.White, fontSize = 64.sp, fontWeight = FontWeight.Bold)
                Text(text = "points earned", color = Color(0xFF8E8E96), fontSize = 16.sp)
                Spacer(modifier = Modifier.height(26.dp))
                CompletionRow(label = "Focused time", value = "${minutes}m ${seconds}s")
                CompletionRow(label = "Mode", value = completionModeLabel(session.mode))
                CompletionRow(label = "Mode multiplier", value = modeMultiplier)
                CompletionRow(label = "Blocked apps", value = session.blockedAppsCount.toString())
                CompletionRow(label = "App bonus", value = appsMultiplier)
                Spacer(modifier = Modifier.height(26.dp))
                Button(
                    onClick = onDone,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF0A84FF),
                        contentColor = Color.White
                    )
                ) {
                    Text(text = "Back to timer", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun CompletionRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 7.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = label, color = Color(0xFF8E8E96), fontSize = 15.sp)
        Text(text = value, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
    }
}

private fun completionModeLabel(mode: String): String {
    return when (mode) {
        "breathing" -> "Breathing"
        "hard" -> "Hard"
        else -> "Reflection"
    }
}
