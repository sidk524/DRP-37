package com.drp37.blocker.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

object TetherColors {
    val Background = Color(0xFF000000)
    val Surface = Color(0x12FFFFFF)
    val SurfaceRaised = Color(0x1AFFFFFF)
    val SurfaceBtn = Color(0x1AFFFFFF)
    val RowFill = Color(0x0AFFFFFF)
    val Border = Color(0x14FFFFFF)
    val BorderStrong = Color(0x24FFFFFF)
    val TextPrimary = Color(0xFFFFFFFF)
    val TextSecondary = Color(0x9EEBEBF5)
    val TextTertiary = Color(0x52EBEBF5)
    val Accent = Color(0xFF0A84FF)
    val AccentSoft = Color(0x240A84FF)
    val AccentRing = Color(0x4D0A84FF)
    val Danger = Color(0xFFFF453A)
    val DotInactive = Color(0x38FFFFFF)
    val InputSurface = Color(0xFF1F1F22)
}

object TetherDimens {
    val RadiusSm = 12.dp
    val Radius = 16.dp
    val RadiusLg = 22.dp
    val ControlHeightSm = 54.dp
    val ControlHeight = 60.dp
    val SectionGap = 22.dp
    val FramePaddingHorizontal = 24.dp
    val FramePaddingVertical = 32.dp
    val ListGap = 10.dp
    val CardPadding = 18.dp
}

object TetherShapes {
    val Sm = RoundedCornerShape(TetherDimens.RadiusSm)
    val Default = RoundedCornerShape(TetherDimens.Radius)
    val Lg = RoundedCornerShape(TetherDimens.RadiusLg)
    val Pill = RoundedCornerShape(99.dp)
}

fun formatDurationPill(hours: Int, minutes: Int): String {
    return when {
        hours > 0 && minutes == 0 -> "${hours}h"
        hours > 0 -> "${hours}h ${minutes}m"
        minutes > 0 -> "${minutes}m"
        else -> "5m"
    }
}
