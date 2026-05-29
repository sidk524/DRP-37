package com.drp37.blocker.data

import android.content.Context
import com.drp37.blocker.model.BlockList

private const val PREFS_NAME = "focus_block_prefs"
private const val KEY_BLOCK_LIST_PACKAGES = "block_list_packages"
private const val KEY_BLOCK_LIST_DURATION_MINUTES = "block_list_duration_minutes"


fun loadBlockList(context: Context): BlockList {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val packages = prefs.getString(KEY_BLOCK_LIST_PACKAGES, "")
        .orEmpty()
        .split('|')
        .filter { it.isNotBlank() }
        .toSet()
    val durationMinutes = prefs.getInt(KEY_BLOCK_LIST_DURATION_MINUTES, 60)

    return BlockList(
        packages = packages,
        durationMinutes = durationMinutes
    )
}

fun saveBlockList(context: Context, blockList: BlockList) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY_BLOCK_LIST_PACKAGES, blockList.packages.sorted().joinToString("|"))
        .putInt(KEY_BLOCK_LIST_DURATION_MINUTES, blockList.durationMinutes)
        .apply()
}
