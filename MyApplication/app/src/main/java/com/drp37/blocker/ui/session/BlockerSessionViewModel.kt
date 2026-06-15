package com.drp37.blocker.ui.session

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.drp37.blocker.local.TetherLocalStore
import com.drp37.blocker.remote.webserver.BlockGroup
import com.drp37.blocker.remote.webserver.BlockSessionRecord
import com.drp37.blocker.remote.webserver.FocusPointsRecord
import com.drp37.blocker.remote.webserver.RemoteSessionSync
import com.drp37.blocker.remote.webserver.SessionSyncClient
import com.drp37.blocker.remote.webserver.WebServerService
import com.drp37.blocker.util.filterAppsForDevice
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import kotlin.math.max

data class BlockerSessionUiState(
    val blockGroups: List<BlockGroup> = emptyList(),
    val blockGroupsLoading: Boolean = false,
    val selectedBlockGroupId: String? = null,
    val savingGroup: Boolean = false,
    val hours: Int = 0,
    val minutes: Int = 0,
    val seconds: Int = 0,
    val sessionRunning: Boolean = false,
    val isStartingSession: Boolean = false,
    val remainingSeconds: Int = 0,
    val activeSessionId: String? = null,
    val activeStartedAtEpochMillis: Long = 0L,
    val activeDurationSeconds: Int = 0,
    val activeBlockedAppsCount: Int = 0,
    val mode: String = "reflect",
    val totalPoints: Int = 0,
    val lastCompletedSession: FocusPointsRecord? = null,
    val errorMessage: String? = null
) {
    val selectedBlockGroup: BlockGroup?
        get() = blockGroups.find { it.id == selectedBlockGroupId }
}

class BlockerSessionViewModel : ViewModel() {
    private val _state = MutableStateFlow(BlockerSessionUiState())
    val state: StateFlow<BlockerSessionUiState> = _state
    private var timerJob: Job? = null
    private var restored = false
    private var installedPackages: Set<String> = emptySet()

    fun setInstalledPackages(packages: Set<String>) {
        installedPackages = packages
    }

    fun deviceAppsForGroup(group: BlockGroup): List<String> {
        return filterAppsForDevice(group.expandedAppsBlocked, installedPackages)
    }

    fun restore(defaultMode: String) {
        if (restored) return
        restored = true
        _state.update { it.copy(mode = normalizeMode(defaultMode)) }
        observeRemoteSync()
        refreshBlockGroups()
        viewModelScope.launch {
            refreshTotalPoints()
            runCatching {
                WebServerService.getCurrentSession()
            }.onSuccess { activeSession ->
                if (activeSession == null) return@onSuccess
                val startedAt = Instant.parse(activeSession.startedAt)
                val elapsedSeconds = Duration.between(startedAt, Instant.now()).seconds.toInt()
                val restoredRemainingSeconds = activeSession.totalDurationSeconds - elapsedSeconds
                if (restoredRemainingSeconds <= 0) {
                    WebServerService.endSession(activeSession.id)
                    TetherLocalStore.clearActiveSession()
                    return@onSuccess
                }
                val mode = TetherLocalStore.getActiveSession()?.mode ?: normalizeMode(defaultMode)
                val localApps = deviceAppsForSession(activeSession)
                TetherLocalStore.setActiveSession(activeSession.copy(appsBlocked = localApps), mode)
                _state.update {
                    it.copy(
                        selectedBlockGroupId = activeSession.blockGroupId ?: it.selectedBlockGroupId,
                        sessionRunning = true,
                        activeSessionId = activeSession.id,
                        activeStartedAtEpochMillis = startedAt.toEpochMilli(),
                        activeDurationSeconds = activeSession.totalDurationSeconds,
                        activeBlockedAppsCount = localApps.size,
                        remainingSeconds = max(1, restoredRemainingSeconds),
                        mode = mode,
                        errorMessage = null
                    )
                }
                startTimer()
            }.onFailure { error ->
                _state.update { it.copy(errorMessage = error.message ?: "Could not restore block session.") }
            }
        }
    }

    fun refreshBlockGroups() {
        _state.update { it.copy(blockGroupsLoading = true) }
        viewModelScope.launch {
            runCatching {
                WebServerService.listBlockGroups()
            }.onSuccess { groups ->
                _state.update { current ->
                    val selectedId = current.selectedBlockGroupId
                        ?.takeIf { id -> groups.any { it.id == id } }
                        ?: groups.firstOrNull()?.id
                    current.copy(
                        blockGroups = groups,
                        blockGroupsLoading = false,
                        selectedBlockGroupId = selectedId
                    )
                }
            }.onFailure { error ->
                _state.update {
                    it.copy(
                        blockGroupsLoading = false,
                        errorMessage = error.message ?: "Could not load block groups."
                    )
                }
            }
        }
    }

    fun selectBlockGroup(groupId: String) {
        if (_state.value.sessionRunning) {
            _state.update { it.copy(errorMessage = "The block group can't be changed when a session is active.") }
            return
        }
        _state.update { it.copy(selectedBlockGroupId = groupId, errorMessage = null) }
    }

    fun saveBlockGroup(
        groupId: String?,
        name: String,
        packages: List<String>,
        domains: List<String>,
        targets: List<String> = emptyList(),
        onSaved: (() -> Unit)? = null
    ) {
        val trimmedName = name.trim()
        if (trimmedName.isEmpty()) {
            _state.update { it.copy(errorMessage = "Give this group a name.") }
            return
        }
        if (packages.isEmpty() && domains.isEmpty() && targets.isEmpty()) {
            _state.update { it.copy(errorMessage = "Choose at least one app or website.") }
            return
        }
        _state.update { it.copy(savingGroup = true, errorMessage = null) }
        viewModelScope.launch {
            runCatching {
                if (groupId == null) {
                    WebServerService.createBlockGroup(
                        name = trimmedName,
                        targets = targets,
                        appsBlocked = packages,
                        domainsBlocked = domains
                    )
                } else {
                    WebServerService.updateBlockGroup(
                        groupId = groupId,
                        name = trimmedName,
                        targets = targets,
                        appsBlocked = packages,
                        domainsBlocked = domains
                    )
                }
            }.onSuccess { group ->
                _state.update { current ->
                    val groups = current.blockGroups.filter { it.id != group.id } + group
                    current.copy(
                        savingGroup = false,
                        blockGroups = groups.sortedWith(
                            compareBy({ it.systemKey == null }, { it.name.lowercase() })
                        ),
                        selectedBlockGroupId = current.selectedBlockGroupId ?: group.id
                    )
                }
                refreshBlockGroups()
                onSaved?.invoke()
            }.onFailure { error ->
                _state.update {
                    it.copy(
                        savingGroup = false,
                        errorMessage = error.message ?: "Could not save block group."
                    )
                }
            }
        }
    }

    fun deleteBlockGroup(groupId: String) {
        viewModelScope.launch {
            runCatching {
                WebServerService.deleteBlockGroup(groupId)
            }.onSuccess {
                _state.update { current ->
                    val groups = current.blockGroups.filter { it.id != groupId }
                    current.copy(
                        blockGroups = groups,
                        selectedBlockGroupId = current.selectedBlockGroupId
                            ?.takeIf { it != groupId }
                            ?: groups.firstOrNull()?.id
                    )
                }
            }.onFailure { error ->
                _state.update { it.copy(errorMessage = error.message ?: "Could not delete block group.") }
            }
        }
    }

    fun setMode(mode: String) {
        val normalized = normalizeMode(mode)
        _state.update { it.copy(mode = normalized) }
        if (_state.value.sessionRunning) {
            TetherLocalStore.updateActiveSessionMode(normalized)
            // Propagate to the server so other devices sync the mode change.
            viewModelScope.launch {
                runCatching { WebServerService.patchSessionMode(normalized) }
            }
        }
    }

    fun setHours(value: Int) {
        _state.update { it.copy(hours = value.coerceAtLeast(0)) }
    }

    fun setMinutes(value: Int) {
        _state.update { it.copy(minutes = value.coerceIn(0, 59)) }
    }

    fun setSeconds(value: Int) {
        _state.update { it.copy(seconds = value.coerceIn(0, 59)) }
    }

    fun startSession() {
        val current = _state.value
        val totalDurationSeconds = (current.hours * 3600 + current.minutes * 60 + current.seconds).takeIf { it > 0 } ?: 5
        val blockGroupId = current.selectedBlockGroupId
        if (blockGroupId == null) {
            _state.update { it.copy(errorMessage = "Choose a block group first.") }
            return
        }
        _state.update { it.copy(isStartingSession = true, errorMessage = null, lastCompletedSession = null) }
        viewModelScope.launch {
            runCatching {
                WebServerService.createSession(
                    blockGroupId = blockGroupId,
                    totalDurationSeconds = totalDurationSeconds,
                    mode = current.mode
                )
            }.onSuccess { session ->
                val startedAt = Instant.parse(session.startedAt)
                val elapsedSeconds = Duration.between(startedAt, Instant.now()).seconds.toInt()
                val localApps = deviceAppsForSession(session)
                TetherLocalStore.setActiveSession(session.copy(appsBlocked = localApps), current.mode)
                _state.update {
                    it.copy(
                        activeSessionId = session.id,
                        activeStartedAtEpochMillis = startedAt.toEpochMilli(),
                        activeDurationSeconds = session.totalDurationSeconds,
                        activeBlockedAppsCount = localApps.size,
                        remainingSeconds = max(1, session.totalDurationSeconds - elapsedSeconds),
                        sessionRunning = true,
                        isStartingSession = false,
                        errorMessage = null
                    )
                }
                startTimer()
            }.onFailure { error ->
                _state.update {
                    it.copy(
                        isStartingSession = false,
                        errorMessage = error.message ?: "Could not start block session."
                    )
                }
            }
        }
    }

    fun stopSessionManually(onStopped: (() -> Unit)? = null) {
        val current = _state.value
        if (current.mode == "hard") {
            _state.update { it.copy(errorMessage = "Hard sessions cannot be ended early.") }
            return
        }
        timerJob?.cancel()
        viewModelScope.launch {
            current.activeSessionId?.let { sessionId ->
                runCatching { WebServerService.endSession(sessionId, reason = "manual") }
            }
            clearActiveSessionState()
            onStopped?.invoke()
        }
    }

    fun clearCompletedSession() {
        _state.update { it.copy(lastCompletedSession = null) }
    }

    fun clearError() {
        _state.update { it.copy(errorMessage = null) }
    }

    private fun deviceAppsForSession(session: BlockSessionRecord): List<String> {
        if (installedPackages.isEmpty()) return session.appsBlocked
        return filterAppsForDevice(session.appsBlocked, installedPackages)
    }

    private fun startTimer() {
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            // Recompute remaining time from the session's wall-clock end each tick
            // (rather than decrementing a counter) so every device counts down to
            // the same instant and they stay in sync.
            while (_state.value.sessionRunning) {
                val current = _state.value
                val endsAtMillis = current.activeStartedAtEpochMillis + current.activeDurationSeconds * 1000L
                val remaining = ((endsAtMillis - System.currentTimeMillis()) / 1000L).toInt()
                if (remaining <= 0) {
                    _state.update { it.copy(remainingSeconds = 0) }
                    expireSession()
                    break
                }
                _state.update { it.copy(remainingSeconds = remaining) }
                delay(1000)
            }
        }
    }

    private suspend fun expireSession() {
        val current = _state.value
        val sessionId = current.activeSessionId
        // The server computes and awards points once per session (idempotent),
        // returning the completed record. Clients no longer calculate points.
        val pointsResult = runCatching {
            WebServerService.endSession(sessionId, reason = "expired")
        }
        val points = pointsResult.getOrNull()
        val pointsError = pointsResult.exceptionOrNull()?.message
        clearActiveSessionState()
        _state.update {
            it.copy(
                hours = 0,
                minutes = 0,
                seconds = 0,
                lastCompletedSession = points,
                errorMessage = pointsError ?: it.errorMessage
            )
        }
        refreshTotalPoints()
    }

    private suspend fun refreshTotalPoints() {
        runCatching { WebServerService.getUserTotalPoints() }
            .onSuccess { total -> _state.update { it.copy(totalPoints = total) } }
    }

    private fun clearActiveSessionState() {
        TetherLocalStore.clearActiveSession()
        _state.update {
            it.copy(
                sessionRunning = false,
                remainingSeconds = 0,
                activeSessionId = null,
                activeStartedAtEpochMillis = 0L,
                activeDurationSeconds = 0,
                activeBlockedAppsCount = 0,
                isStartingSession = false
            )
        }
    }

    private fun normalizeMode(mode: String): String {
        return when (mode) {
            "breathing" -> "breathing"
            "hard" -> "hard"
            else -> "reflect"
        }
    }

    // Listen for session changes pushed from other devices. The server already
    // excludes this device's own changes, and we guard again by device id.
    private fun observeRemoteSync() {
        viewModelScope.launch {
            SessionSyncClient.events.collect { event -> applyRemoteSync(event) }
        }
    }

    private suspend fun applyRemoteSync(event: RemoteSessionSync) {
        val localDeviceId = TetherLocalStore.getOrCreateDeviceId()
        if (event.originDeviceId != null && event.originDeviceId == localDeviceId) return

        val current = _state.value
        val session = event.session

        if (session == null) {
            // Remote stop / expiry. Clear local blocking even for hard mode — the
            // hard-mode rule only blocks *local manual* stops.
            if (!current.sessionRunning && current.activeSessionId == null) return
            timerJob?.cancel()
            clearActiveSessionState()
            // If the other device completed the session (expiry), show the same
            // completion screen with the server-awarded points. A manual remote
            // stop carries no record and simply returns to setup.
            if (event.completed != null) {
                _state.update {
                    it.copy(hours = 0, minutes = 0, seconds = 0, lastCompletedSession = event.completed)
                }
                refreshTotalPoints()
            }
            return
        }

        val serverMode = normalizeMode(session.mode)

        if (current.activeSessionId == session.id) {
            if (serverMode != current.mode) {
                TetherLocalStore.updateActiveSessionMode(serverMode)
                _state.update { it.copy(mode = serverMode) }
            }
            return
        }

        // Remote start (or replacement) of a session this device is not running.
        val startedAt = runCatching { Instant.parse(session.startedAt) }.getOrNull() ?: return
        val elapsedSeconds = Duration.between(startedAt, Instant.now()).seconds.toInt()
        val remainingSeconds = session.totalDurationSeconds - elapsedSeconds
        if (remainingSeconds <= 0) return

        val localApps = deviceAppsForSession(session)
        TetherLocalStore.setActiveSession(session.copy(appsBlocked = localApps), serverMode)
        timerJob?.cancel()
        _state.update {
            it.copy(
                selectedBlockGroupId = session.blockGroupId ?: it.selectedBlockGroupId,
                sessionRunning = true,
                activeSessionId = session.id,
                activeStartedAtEpochMillis = startedAt.toEpochMilli(),
                activeDurationSeconds = session.totalDurationSeconds,
                activeBlockedAppsCount = localApps.size,
                remainingSeconds = max(1, remainingSeconds),
                mode = serverMode,
                isStartingSession = false,
                errorMessage = null
            )
        }
        startTimer()
    }
}
