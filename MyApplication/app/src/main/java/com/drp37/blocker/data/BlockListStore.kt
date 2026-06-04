package com.drp37.blocker.data

import android.content.Context
import com.drp37.blocker.model.BlockList

private const val PREFS_NAME = "focus_block_prefs"
private const val KEY_BLOCK_LIST_PACKAGES = "block_list_packages"
private const val KEY_BLOCK_LIST_DURATION_MINUTES = "block_list_duration_minutes"
private const val KEY_BLOCK_LIST_MODE = "block_list_mode"


fun loadBlockList(context: Context): BlockList {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val packages = prefs.getString(KEY_BLOCK_LIST_PACKAGES, "")
        .orEmpty()
        .split('|')
        .filter { it.isNotBlank() }
        .toSet()
    val durationMinutes = prefs.getInt(KEY_BLOCK_LIST_DURATION_MINUTES, 30)
    val mode = prefs.getString(KEY_BLOCK_LIST_MODE, "breathing").orEmpty().ifBlank { "breathing" }

    return BlockList(
        packages = packages,
        durationMinutes = durationMinutes,
        mode = mode,
    )
}

fun saveBlockList(context: Context, blockList: BlockList) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY_BLOCK_LIST_PACKAGES, blockList.packages.sorted().joinToString("|"))
        .putInt(KEY_BLOCK_LIST_DURATION_MINUTES, blockList.durationMinutes)
        .putString(KEY_BLOCK_LIST_MODE, blockList.mode)
        .apply()
}
