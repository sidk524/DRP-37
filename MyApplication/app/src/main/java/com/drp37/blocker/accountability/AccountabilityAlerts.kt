package com.drp37.blocker.accountability

import com.drp37.blocker.remote.webserver.WebServerService

object AccountabilityAlerts {
    suspend fun clearAttemptAfterReply(attemptId: String, notificationRowId: String?) {
        AccountabilityNotifier.cancelAttemptNotification(attemptId)
        if (!notificationRowId.isNullOrBlank()) {
            runCatching { WebServerService.markAccountabilityNotificationRead(notificationRowId) }
        }
    }
}
