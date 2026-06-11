package com.drp37.blocker.ui.session

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.drp37.blocker.local.TetherLocalStore
import com.drp37.blocker.remote.webserver.BlockGroup
import com.drp37.blocker.remote.webserver.BlockSessionRecord
import com.drp37.blocker.remote.webserver.FocusPointsRecord
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
                    totalDurationSeconds = totalDurationSeconds
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
                runCatching { WebServerService.endSession(sessionId) }
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
            while (_state.value.sessionRunning && _state.value.remainingSeconds > 0) {
                delay(1000)
                _state.update { current ->
                    if (!current.sessionRunning) current else current.copy(
                        remainingSeconds = (current.remainingSeconds - 1).coerceAtLeast(0)
                    )
                }
            }
            if (_state.value.sessionRunning && _state.value.remainingSeconds <= 0) {
                expireSession()
            }
        }
    }

    private suspend fun expireSession() {
        val current = _state.value
        val sessionId = current.activeSessionId
        val endedAt = Instant.now()
        val plannedMs = current.activeDurationSeconds * 1000L
        val actualMs = if (current.activeStartedAtEpochMillis > 0L) {
            endedAt.toEpochMilli() - current.activeStartedAtEpochMillis
        } else {
            plannedMs
        }
        if (sessionId != null) {
            runCatching { WebServerService.endSession(sessionId) }
        }
        val pointsResult = runCatching {
            WebServerService.saveSessionPoints(
                mode = current.mode,
                actualMs = actualMs,
                plannedMs = plannedMs,
                blockedAppsCount = current.activeBlockedAppsCount.coerceAtLeast(1),
                endedAt = endedAt.toString()
            )
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
}
