package com.drp37.blocker.util

/**
 * Filters an expanded cross-platform package list down to apps that are
 * actually installed on this device. Server-stored block groups keep the full
 * definition; Android only displays and enforces what exists locally.
 */
fun filterAppsForDevice(packages: List<String>, installed: Set<String>): List<String> {
    return packages.filter { it in installed }
}
