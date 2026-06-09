package com.drp37.blocker.util

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.graphics.drawable.toBitmap
import com.drp37.blocker.model.InstalledApp

fun loadLaunchableApps(context: Context): List<InstalledApp> {
    val packageManager = context.packageManager
    val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)

    return packageManager.queryIntentActivities(launcherIntent, PackageManager.MATCH_ALL)
        .asSequence()
        .mapNotNull { resolveInfo ->
            val packageName = resolveInfo.activityInfo?.packageName ?: return@mapNotNull null
            if (packageName == context.packageName) return@mapNotNull null
            val label = resolveInfo.loadLabel(packageManager)?.toString()?.trim().orEmpty()
            val displayLabel = label.ifBlank { packageName }
            InstalledApp(
                label = displayLabel,
                packageName = packageName,
                icon = resolveInfo.loadIcon(packageManager).toBitmap(width = 96, height = 96)
            )
        }
        .distinctBy { it.packageName }
        .sortedBy { it.label.lowercase() }
        .toList()
}
