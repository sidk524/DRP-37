package com.drp37.blocker.model

import android.graphics.Bitmap

data class InstalledApp(
    val label: String,
    val packageName: String,
    val icon: Bitmap
)

data class BlockList(
    val packages: Set<String> = emptySet(),
    val durationMinutes: Int = 30,
    val mode: String = "breathing",
)
