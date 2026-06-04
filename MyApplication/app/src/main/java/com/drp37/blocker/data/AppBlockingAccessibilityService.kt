package com.drp37.blocker.data

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent

class AppBlockingAccessibilityService : AccessibilityService() {
    private var lastBlockedPackage: String? = null
    private var lastBlockedAtMillis: Long = 0L

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val packageName = event?.packageName?.toString() ?: return
        if (packageName == this.packageName) return

        val session = loadActiveBlockSession(this) ?: return
        if (packageName !in session.packages) return

        val now = System.currentTimeMillis()
        if (packageName == lastBlockedPackage && now - lastBlockedAtMillis < 1000L) return

        lastBlockedPackage = packageName
        lastBlockedAtMillis = now
        performGlobalAction(GLOBAL_ACTION_HOME)
    }

    override fun onInterrupt() = Unit
}
