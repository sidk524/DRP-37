package com.drp37.blocker.model

import android.graphics.Bitmap

data class InstalledApp(
    val label: String,
    val packageName: String,
    val icon: Bitmap
)

data class BlockList(
    val packages: Set<String>,
    val durationMinutes: Int
)
