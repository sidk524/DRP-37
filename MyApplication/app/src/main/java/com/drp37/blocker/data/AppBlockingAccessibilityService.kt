package com.drp37.blocker.data

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent
import com.drp37.blocker.MainActivity

class AppBlockingAccessibilityService : AccessibilityService() {
    private var lastBlockedPackage: String? = null
    private var lastBlockedAtMillis: Long = 0L

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val packageName = event?.packageName?.toString() ?: return
        if (packageName == this.packageName) return

        val session = loadActiveBlockSession(this) ?: return
        if (packageName !in session.packages) return
        if (isBlockedPackageTemporarilyAllowed(this, packageName)) return

        val now = System.currentTimeMillis()
        if (packageName == lastBlockedPackage && now - lastBlockedAtMillis < 1000L) return

        lastBlockedPackage = packageName
        lastBlockedAtMillis = now
        val intent = Intent(this, MainActivity::class.java)
            .setAction(FrictionIntentContract.ACTION_SHOW_FRICTION)
            .putExtra(FrictionIntentContract.EXTRA_BLOCKED_PACKAGE, packageName)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        startActivity(intent)
    }

    override fun onInterrupt() = Unit
}
