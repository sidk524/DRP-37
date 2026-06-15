package com.drp37.blocker.accountability

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.RemoteInput
import com.drp37.blocker.MainActivity
import com.drp37.blocker.R

object AccountabilityNotifier {
    const val EXTRA_ATTEMPT_ID = "attempt_id"
    const val EXTRA_PRESET_KEY = "preset_key"
    const val EXTRA_MESSAGE_ID = "message_id"
    const val EXTRA_NOTIFICATION_ID = "notification_id"
    const val ACTION_REPLY_PRESET = "com.drp37.blocker.accountability.REPLY_PRESET"
    const val ACTION_REPLY_CUSTOM = "com.drp37.blocker.accountability.REPLY_CUSTOM"
    const val ACTION_DISMISS_MESSAGE = "com.drp37.blocker.accountability.DISMISS_MESSAGE"
    const val OPEN_INBOX = "open_accountability_inbox"
    const val REMOTE_INPUT_KEY = "reply_text"

    private const val CHANNEL_ATTEMPTS = "accountability_attempts"
    private const val CHANNEL_MESSAGES = "accountability_messages"
    private lateinit var context: Context

    fun init(value: Context) {
        context = value.applicationContext
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ATTEMPTS, "Friend accountability", NotificationManager.IMPORTANCE_HIGH)
        )
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_MESSAGES, "Encouragement", NotificationManager.IMPORTANCE_DEFAULT)
        )
    }

    fun showAttemptNotification(
        attemptId: String,
        actorDisplayName: String,
        targetLabel: String,
        mode: String
    ) {
        if (attemptId.isBlank()) return
        val notificationId = notificationIdForAttempt(attemptId)
        val title = "$actorDisplayName needs accountability"
        val body = "$targetLabel · $mode"
        val builder = NotificationCompat.Builder(context, CHANNEL_ATTEMPTS)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(openAppIntent(notificationId))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
        listOf(
            "lock_in" to "Lock in",
            "stay_focused" to "Stay focused",
            "youve_got_this" to "You've got this"
        ).forEach { (presetKey, label) ->
            builder.addAction(presetAction(attemptId, notificationId, presetKey, label))
        }
        val remoteInput = RemoteInput.Builder(REMOTE_INPUT_KEY)
            .setLabel("Reply")
            .build()
        val replyIntent = Intent(context, AccountabilityReplyReceiver::class.java).apply {
            action = ACTION_REPLY_CUSTOM
            putExtra(EXTRA_ATTEMPT_ID, attemptId)
            putExtra(EXTRA_NOTIFICATION_ID, notificationId)
        }
        val replyPendingIntent = PendingIntent.getBroadcast(
            context,
            ("reply-$attemptId").hashCode(),
            replyIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        builder.addAction(
            NotificationCompat.Action.Builder(R.mipmap.ic_launcher, "Reply", replyPendingIntent)
                .addRemoteInput(remoteInput)
                .build()
        )
        context.getSystemService(NotificationManager::class.java).notify(notificationId, builder.build())
    }

    fun showEncouragementNotification(
        messageId: String,
        senderDisplayName: String,
        body: String
    ) {
        val notificationId = if (messageId.isNotBlank()) {
            notificationIdForMessage(messageId)
        } else {
            (System.currentTimeMillis() % Int.MAX_VALUE).toInt()
        }
        val title = "Encouragement"
        val text = "From $senderDisplayName: $body"
        val openIntent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra(OPEN_INBOX, true)
        }
        val openPendingIntent = PendingIntent.getActivity(
            context,
            ("open-$messageId").hashCode(),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val dismissIntent = Intent(context, AccountabilityReplyReceiver::class.java).apply {
            action = ACTION_DISMISS_MESSAGE
            if (messageId.isNotBlank()) putExtra(EXTRA_MESSAGE_ID, messageId)
            putExtra(EXTRA_NOTIFICATION_ID, notificationId)
        }
        val dismissPendingIntent = PendingIntent.getBroadcast(
            context,
            ("dismiss-$messageId").hashCode(),
            dismissIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_MESSAGES)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(openPendingIntent)
            .addAction(R.mipmap.ic_launcher, "Open", openPendingIntent)
            .addAction(R.mipmap.ic_launcher, "Dismiss", dismissPendingIntent)
            .setAutoCancel(true)
            .build()
        context.getSystemService(NotificationManager::class.java).notify(notificationId, notification)
    }

    fun cancelAttemptNotification(attemptId: String) {
        context.getSystemService(NotificationManager::class.java)
            .cancel(notificationIdForAttempt(attemptId))
    }

    fun notificationIdForAttempt(attemptId: String) = attemptId.hashCode()

    private fun notificationIdForMessage(messageId: String) = "msg-$messageId".hashCode()

    private fun presetAction(
        attemptId: String,
        notificationId: Int,
        presetKey: String,
        label: String
    ): NotificationCompat.Action {
        val intent = Intent(context, AccountabilityReplyReceiver::class.java).apply {
            action = ACTION_REPLY_PRESET
            putExtra(EXTRA_ATTEMPT_ID, attemptId)
            putExtra(EXTRA_PRESET_KEY, presetKey)
            putExtra(EXTRA_NOTIFICATION_ID, notificationId)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            ("$attemptId-$presetKey").hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Action.Builder(R.mipmap.ic_launcher, label, pendingIntent).build()
    }

    private fun openAppIntent(requestCode: Int): PendingIntent {
        return PendingIntent.getActivity(
            context,
            requestCode,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
