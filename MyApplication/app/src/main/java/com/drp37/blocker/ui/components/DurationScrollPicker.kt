package com.drp37.blocker.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.max

@Composable
fun DurationScrollPicker(
    durationMinutes: Int,
    onDurationChange: (Int) -> Unit,
    screenWidth: Dp,
    modifier: Modifier = Modifier,
    locked: Boolean = false,
) {
    val totalSeconds = (durationMinutes.coerceAtLeast(1) * 60).coerceAtLeast(5)
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60

    val layout = remember(screenWidth) {
        DurationPickerLayoutMetrics(screenWidth)
    }

    fun publish(h: Int, m: Int, s: Int) {
        val combined = (h * 3600 + m * 60 + s).coerceAtLeast(5)
        onDurationChange(max(1, (combined + 59) / 60))
    }

    Box(
        modifier = modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .width(layout.pickerWidth)
                .height(layout.pickerHeight)
                .clip(RoundedCornerShape(layout.pickerRadius))
                .background(Color(0xFF1F1F22)),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                modifier = Modifier
                    .align(Alignment.Center)
                    .fillMaxWidth()
                    .padding(horizontal = layout.pickerHorizontalPadding),
            ) {
                Box(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .fillMaxWidth()
                        .height(layout.pickerSelectedRowHeight)
                        .clip(RoundedCornerShape(layout.pickerSelectedRadius))
                        .background(Color(0xFF48484F)),
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(layout.pickerWheelHeight),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    DurationWheel(
                        value = hours,
                        values = 0..23,
                        locked = locked,
                        layout = layout,
                        onValueChange = { publish(it, minutes, seconds) },
                    )
                    DurationWheel(
                        value = minutes,
                        values = 0..59,
                        locked = locked,
                        layout = layout,
                        onValueChange = { publish(hours, it, seconds) },
                    )
                    DurationWheel(
                        value = seconds,
                        values = 0..59,
                        locked = locked,
                        layout = layout,
                        onValueChange = { publish(hours, minutes, it) },
                    )
                }

                Row(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .fillMaxWidth()
                        .height(layout.pickerSelectedRowHeight),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    DurationUnitLabel("hours", layout)
                    DurationUnitLabel("min", layout)
                    DurationUnitLabel("sec", layout)
                }
            }
        }
    }
}

@Composable
private fun DurationWheel(
    value: Int,
    values: IntRange,
    locked: Boolean,
    layout: DurationPickerLayoutMetrics,
    onValueChange: (Int) -> Unit,
) {
    val items = remember(values) { values.toList() }
    val initialIndex = items.indexOf(value).coerceAtLeast(0)
    val listState = rememberLazyListState(initialFirstVisibleItemIndex = initialIndex)
    val rowHeightPx = with(LocalDensity.current) { layout.pickerSelectedRowHeight.toPx() }
    val selectedIndex by remember {
        derivedStateOf {
            (listState.firstVisibleItemIndex + if (listState.firstVisibleItemScrollOffset > rowHeightPx * 0.5f) 1 else 0)
                .coerceIn(0, items.lastIndex)
        }
    }
    val selectedValue = items[selectedIndex]

    LaunchedEffect(selectedValue) {
        if (!locked && selectedValue != value) {
            onValueChange(selectedValue)
        }
    }

    LaunchedEffect(value) {
        val targetIndex = items.indexOf(value).coerceAtLeast(0)
        if (listState.firstVisibleItemIndex != targetIndex ||
            listState.firstVisibleItemScrollOffset > rowHeightPx * 0.5f
        ) {
            listState.animateScrollToItem(targetIndex)
        }
    }

    LazyColumn(
        state = listState,
        flingBehavior = rememberSnapFlingBehavior(lazyListState = listState),
        userScrollEnabled = !locked,
        modifier = Modifier
            .width(layout.pickerColumnWidth)
            .height(layout.pickerWheelHeight),
        contentPadding = PaddingValues(vertical = layout.pickerWheelVerticalPadding),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        items(items) { item ->
            val selected = item == selectedValue
            Box(
                modifier = Modifier
                    .width(layout.pickerColumnWidth)
                    .height(layout.pickerSelectedRowHeight),
                contentAlignment = Alignment.CenterStart,
            ) {
                Text(
                    text = item.toString().padStart(2, '0'),
                    color = if (selected) Color.White else Color(0xFF5E5E66),
                    fontSize = if (selected) layout.pickerValueTextSize.sp else layout.pickerMutedTextSize.sp,
                    letterSpacing = 0.sp,
                    lineHeight = if (selected) layout.pickerValueTextSize.sp else layout.pickerMutedTextSize.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.width(layout.pickerNumberLaneWidth),
                )
            }
        }
    }
}

@Composable
private fun DurationUnitLabel(label: String, layout: DurationPickerLayoutMetrics) {
    Box(
        modifier = Modifier.width(layout.pickerColumnWidth),
        contentAlignment = Alignment.CenterStart,
    ) {
        Text(
            text = label,
            color = Color(0xFFB0B0B8),
            fontSize = layout.pickerUnitTextSize.sp,
            lineHeight = layout.pickerUnitTextSize.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            modifier = Modifier.padding(start = layout.pickerLabelStart),
        )
    }
}

private data class DurationPickerLayoutMetrics(
    val pickerWidth: Dp,
    val pickerHeight: Dp,
    val pickerRadius: Dp,
    val pickerHorizontalPadding: Dp,
    val pickerSelectedRowHeight: Dp,
    val pickerSelectedRadius: Dp,
    val pickerWheelHeight: Dp,
    val pickerColumnWidth: Dp,
    val pickerNumberLaneWidth: Dp,
    val pickerLabelStart: Dp,
    val pickerWheelVerticalPadding: Dp,
    val pickerValueTextSize: Float,
    val pickerUnitTextSize: Float,
    val pickerMutedTextSize: Float,
) {
    companion object {
        operator fun invoke(screenWidth: Dp): DurationPickerLayoutMetrics {
            val pickerWidth = screenWidth * 0.90f
            val pickerHorizontalPadding = pickerWidth * 0.045f
            val pickerInnerWidth = pickerWidth - (pickerHorizontalPadding * 2f)
            val pickerColumnWidth = pickerInnerWidth / 3f
            val pickerNumberLaneWidth = pickerColumnWidth * 0.44f

            return DurationPickerLayoutMetrics(
                pickerWidth = pickerWidth,
                pickerHeight = (pickerWidth * 0.46f).coerceIn(154.dp, 210.dp),
                pickerRadius = 22.dp,
                pickerHorizontalPadding = pickerHorizontalPadding,
                pickerSelectedRowHeight = (pickerWidth * 0.145f).coerceIn(50.dp, 68.dp),
                pickerSelectedRadius = 12.dp,
                pickerWheelHeight = (pickerWidth * 0.435f).coerceIn(150.dp, 204.dp),
                pickerColumnWidth = pickerColumnWidth,
                pickerNumberLaneWidth = pickerNumberLaneWidth,
                pickerLabelStart = pickerNumberLaneWidth + (pickerColumnWidth * 0.02f),
                pickerWheelVerticalPadding = (pickerWidth * 0.145f).coerceIn(50.dp, 68.dp),
                pickerValueTextSize = (pickerWidth.value * 0.082f).coerceIn(27f, 38f),
                pickerUnitTextSize = (pickerWidth.value * 0.043f).coerceIn(14f, 20f),
                pickerMutedTextSize = (pickerWidth.value * 0.078f).coerceIn(26f, 36f),
            )
        }
    }
}
