package com.drp37.blocker.remote.webserver

import com.drp37.blocker.BuildConfig
import com.drp37.blocker.accountability.AccountabilityNotifier
import com.drp37.blocker.auth.AuthService
import com.drp37.blocker.local.TetherLocalStore
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.websocket.WebSockets
import io.ktor.client.plugins.websocket.webSocket
import io.ktor.websocket.Frame
import io.ktor.websocket.readText
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * Event pushed by the web server when a block session changes on any device.
 * [session] is null when there is no active session (remote stop / expiry).
 */
data class RemoteSessionSync(
    val session: BlockSessionRecord?,
    val completed: FocusPointsRecord?,
    val originDeviceId: String?,
    val revision: Long
)

/**
 * Maintains a WebSocket to the web server's session sync hub and republishes
 * `session.sync` frames as [events]. Transport only — applying the events is the
 * ViewModel's job, mirroring how REST stays the write path.
 */
object SessionSyncClient {
    private const val SYNC_PATH = "/api/session/sync"
    private const val INITIAL_BACKOFF_MS = 1_000L
    private const val MAX_BACKOFF_MS = 30_000L

    private val client by lazy {
        HttpClient(OkHttp) {
            install(WebSockets)
        }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var connectionJob: Job? = null

    private val _events = MutableSharedFlow<RemoteSessionSync>(extraBufferCapacity = 16)
    val events: SharedFlow<RemoteSessionSync> = _events.asSharedFlow()

    private val _unreadCount = MutableSharedFlow<Int>(extraBufferCapacity = 8)
    val unreadCount: SharedFlow<Int> = _unreadCount.asSharedFlow()

    @Synchronized
    fun start() {
        if (connectionJob?.isActive == true) return
        connectionJob = scope.launch { runConnectionLoop() }
    }

    @Synchronized
    fun stop() {
        connectionJob?.cancel()
        connectionJob = null
    }

    private suspend fun runConnectionLoop() {
        var backoff = INITIAL_BACKOFF_MS
        while (currentCoroutineActive()) {
            val token = AuthService.currentAccessToken()
            val url = token?.let { syncUrl(it) }
            if (url == null) {
                delay(backoff)
                backoff = (backoff * 2).coerceAtMost(MAX_BACKOFF_MS)
                continue
            }
            try {
                client.webSocket(urlString = url) {
                    backoff = INITIAL_BACKOFF_MS
                    send(Frame.Text(helloMessage()))
                    for (frame in incoming) {
                        if (frame is Frame.Text) {
                            handleFrame(frame.readText())
                        }
                    }
                }
            } catch (_: Throwable) {
                // Connection failed or dropped — fall through to backoff + retry.
            }
            if (!currentCoroutineActive()) break
            delay(backoff)
            backoff = (backoff * 2).coerceAtMost(MAX_BACKOFF_MS)
        }
    }

    private suspend fun currentCoroutineActive(): Boolean {
        return kotlin.coroutines.coroutineContext[Job]?.isActive ?: false
    }

    private suspend fun handleFrame(text: String) {
        val json = runCatching { JSONObject(text) }.getOrNull() ?: return
        when (json.optString("type")) {
            "accountability.attempt" -> {
                val notification = json.optJSONObject("notification") ?: return
                val attempt = notification.optJSONObject("attempt")
                AccountabilityNotifier.show(
                    "${notification.optString("actorDisplayName", "A friend")} needs accountability",
                    "${attempt?.optString("target_label", "Blocked app")} · ${attempt?.optString("mode", "focus")}"
                )
            }
            "accountability.message" -> {
                val message = json.optJSONObject("message") ?: return
                AccountabilityNotifier.show(
                    "${message.optString("senderDisplayName", "A friend")} sent encouragement",
                    message.optString("body", "Stay focused")
                )
            }
            "accountability.unread" -> {
                _unreadCount.emit(json.optInt("unreadCount", 0))
            }
            "session.sync" -> {
                val sessionJson = json.optJSONObject("session")
                val session = sessionJson?.let { runCatching { it.toBlockSessionRecord() }.getOrNull() }
                val completedJson = json.optJSONObject("completed")
                val completed = completedJson?.let { runCatching { it.toFocusPointsRecord() }.getOrNull() }
                val originDeviceId = json.optString("originDeviceId").takeUnless { it.isBlank() || it == "null" }
                val revision = json.optLong("revision", 0L)
                _events.emit(
                    RemoteSessionSync(
                        session = session,
                        completed = completed,
                        originDeviceId = originDeviceId,
                        revision = revision
                    )
                )
            }
        }
    }

    private fun helloMessage(): String {
        return JSONObject()
            .put("type", "hello")
            .put("deviceId", TetherLocalStore.getOrCreateDeviceId())
            .put("platform", "android")
            .toString()
    }

    private fun syncUrl(token: String): String? {
        val raw = BuildConfig.WEB_SERVER_URL.trim()
        if (raw.isBlank()) return null
        val withScheme = when {
            raw.startsWith("https://", ignoreCase = true) -> "wss://" + raw.removePrefix("https://").removePrefix("HTTPS://")
            raw.startsWith("http://", ignoreCase = true) -> "ws://" + raw.removePrefix("http://").removePrefix("HTTP://")
            else -> "ws://$raw"
        }.trimEnd('/')
        val encodedToken = java.net.URLEncoder.encode(token, "UTF-8")
        return "$withScheme$SYNC_PATH?access_token=$encodedToken"
    }
}
