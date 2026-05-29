package com.drp37.blocker

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent
import com.drp37.blocker.data.isActiveBlockSession
import com.drp37.blocker.data.loadActiveBlockedPackages

class AppBlockAccessibilityService : AccessibilityService() {
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

        val openedPackageName = event.packageName?.toString().orEmpty()
        if (openedPackageName.isBlank() || openedPackageName == packageName) return
        if (!isActiveBlockSession(this)) return
        if (openedPackageName !in loadActiveBlockedPackages(this)) return

        val intent = Intent(this, BlockedAppActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra(BlockedAppActivity.EXTRA_BLOCKED_PACKAGE, openedPackageName)
        }
        startActivity(intent)
    }

    override fun onInterrupt() = Unit
}
