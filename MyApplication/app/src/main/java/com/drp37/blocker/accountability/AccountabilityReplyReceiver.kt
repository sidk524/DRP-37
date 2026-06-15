package com.drp37.blocker.accountability

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.RemoteInput
import com.drp37.blocker.remote.webserver.WebServerService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class AccountabilityReplyReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pendingResult = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                when (intent.action) {
                    AccountabilityNotifier.ACTION_REPLY_PRESET -> {
                        val attemptId = intent.getStringExtra(AccountabilityNotifier.EXTRA_ATTEMPT_ID) ?: return@launch
                        val presetKey = intent.getStringExtra(AccountabilityNotifier.EXTRA_PRESET_KEY) ?: return@launch
                        runCatching { WebServerService.sendAccountabilityPreset(attemptId, presetKey) }
                            .onSuccess { AccountabilityNotifier.cancelAttemptNotification(attemptId) }
                    }
                    AccountabilityNotifier.ACTION_REPLY_CUSTOM -> {
                        val attemptId = intent.getStringExtra(AccountabilityNotifier.EXTRA_ATTEMPT_ID) ?: return@launch
                        val body = RemoteInput.getResultsFromIntent(intent)
                            ?.getCharSequence(AccountabilityNotifier.REMOTE_INPUT_KEY)
                            ?.toString()
                            ?.trim()
                            .orEmpty()
                        if (body.isEmpty()) return@launch
                        runCatching { WebServerService.sendAccountabilityMessage(attemptId, body) }
                            .onSuccess { AccountabilityNotifier.cancelAttemptNotification(attemptId) }
                    }
                    AccountabilityNotifier.ACTION_DISMISS_MESSAGE -> {
                        val messageId = intent.getStringExtra(AccountabilityNotifier.EXTRA_MESSAGE_ID)
                        if (!messageId.isNullOrBlank()) {
                            runCatching { WebServerService.markAccountabilityMessageRead(messageId) }
                        }
                        val notificationId = intent.getIntExtra(AccountabilityNotifier.EXTRA_NOTIFICATION_ID, 0)
                        if (notificationId != 0) {
                            context.getSystemService(android.app.NotificationManager::class.java)
                                .cancel(notificationId)
                        }
                    }
                }
            } finally {
                pendingResult.finish()
            }
        }
    }
}
