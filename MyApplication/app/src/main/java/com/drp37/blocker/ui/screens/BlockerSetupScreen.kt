package com.drp37.blocker.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drp37.blocker.data.loadLaunchableApps
import com.drp37.blocker.model.InstalledApp
import com.drp37.blocker.ui.theme.MyApplicationTheme
import kotlin.math.max

@Composable
fun BlockerSetupScreen() {
    val context = LocalContext.current
    val installedApps = remember { loadLaunchableApps(context) }
    val selectedPackages = remember(installedApps) {
        mutableStateMapOf<String, Boolean>().apply {
            installedApps.forEach { app -> put(app.packageName, false) }
        }
    }
    var query by remember { mutableStateOf("") }

    val selectedCount = selectedPackages.count { it.value }
    val visibleApps = remember(installedApps, query) {
        filterApps(installedApps, query)
    }

    Surface(modifier = Modifier.fillMaxSize(), color = Color.Black) {
        BoxWithConstraints(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            val contentHeight = maxHeight * 0.90f
            val contentWidth = (maxWidth * 0.84f).coerceAtMost(620.dp)
            val layout = remember(contentWidth, contentHeight) {
                BlockAppsLayoutMetrics(contentWidth, contentHeight)
            }

            Column(
                modifier = Modifier
                    .width(contentWidth)
                    .height(contentHeight),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                TopBar(layout = layout)

                Spacer(modifier = Modifier.height(layout.topBarToTitleGap))

                Text(
                    text = "Block Apps",
                    color = Color.White,
                    fontSize = layout.titleTextSize.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.sp,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(layout.titleToCountGap))

                Text(
                    text = "$selectedCount apps selected",
                    color = Color(0xFF92929A),
                    fontSize = layout.bodyTextSize.sp,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(layout.countToSearchGap))

                SearchField(
                    value = query,
                    layout = layout,
                    onValueChange = { query = it }
                )

                Spacer(modifier = Modifier.height(layout.searchToGridGap))

                LazyVerticalGrid(
                    columns = GridCells.Fixed(4),
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentPadding = PaddingValues(bottom = layout.gridBottomPadding),
                    horizontalArrangement = Arrangement.spacedBy(layout.gridColumnGap),
                    verticalArrangement = Arrangement.spacedBy(layout.gridRowGap)
                ) {
                    items(visibleApps, key = { it.packageName }) { app ->
                        val selected = selectedPackages[app.packageName] == true
                        AppGridItem(
                            app = app,
                            selected = selected,
                            layout = layout,
                            onClick = {
                                selectedPackages[app.packageName] = !selected
                            }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(layout.gridToButtonGap))

                Button(
                    onClick = {},
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(layout.startButtonHeight),
                    shape = RoundedCornerShape(layout.startButtonRadius),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF0A84FF),
                        contentColor = Color.White
                    )
                ) {
                    Text(
                        text = "Start Session · $selectedCount apps",
                        fontSize = layout.buttonTextSize.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun TopBar(layout: BlockAppsLayoutMetrics) {
    Box(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.align(Alignment.CenterStart),
            verticalAlignment = Alignment.CenterVertically
        ) {
            BackChevron(size = layout.topIconSize)
            Text(
                text = "Back",
                color = Color(0xFF0A84FF),
                fontSize = layout.navTextSize.sp,
                letterSpacing = 0.sp
            )
        }

        Text(
            text = "5m",
            color = Color(0xFF8E8E96),
            fontSize = layout.navTextSize.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.align(Alignment.Center)
        )
    }
}

@Composable
private fun SearchField(
    value: String,
    layout: BlockAppsLayoutMetrics,
    onValueChange: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(layout.searchHeight)
            .clip(RoundedCornerShape(layout.searchRadius))
            .background(Color(0xFF1F1F22))
            .padding(horizontal = layout.searchHorizontalPadding),
        verticalAlignment = Alignment.CenterVertically
    ) {
        SearchIcon(size = layout.searchIconSize)

        Spacer(modifier = Modifier.width(layout.searchIconGap))

        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.weight(1f),
            singleLine = true,
            textStyle = TextStyle(
                color = Color.White,
                fontSize = layout.searchTextSize.sp
            ),
            decorationBox = { innerTextField ->
                if (value.isEmpty()) {
                    Text(
                        text = "Search",
                        color = Color(0xFF9B9BA3),
                        fontSize = layout.searchTextSize.sp
                    )
                }
                innerTextField()
            }
        )
    }
}

@Composable
private fun AppGridItem(
    app: InstalledApp,
    selected: Boolean,
    layout: BlockAppsLayoutMetrics,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(contentAlignment = Alignment.TopEnd) {
            Image(
                bitmap = app.icon.asImageBitmap(),
                contentDescription = app.label,
                modifier = Modifier
                    .size(layout.appIconSize)
                    .clip(RoundedCornerShape(layout.appIconRadius))
                    .graphicsLayer { alpha = if (selected) 1f else 0.45f },
                colorFilter = if (selected) null else grayscaleFilter()
            )

            if (selected) {
                Box(
                    modifier = Modifier
                        .size(layout.checkSize)
                        .clip(CircleShape)
                        .background(Color(0xFF0A84FF)),
                    contentAlignment = Alignment.Center
                ) {
                    CheckMark(size = layout.checkIconSize)
                }
            }
        }

        Spacer(modifier = Modifier.height(layout.appLabelGap))

        Text(
            text = app.label,
            color = if (selected) Color.White else Color(0xFF85858C),
            fontSize = layout.appLabelTextSize.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

private fun filterApps(apps: List<InstalledApp>, query: String): List<InstalledApp> {
    val normalizedQuery = query.trim().lowercase()
    if (normalizedQuery.isEmpty()) return apps

    return apps
        .map { app ->
            val label = app.label.lowercase()
            val packageName = app.packageName.lowercase()
            val compactLabel = label.filterNot(Char::isWhitespace)
            val compactQuery = normalizedQuery.filterNot(Char::isWhitespace)
            val score = when {
                label == normalizedQuery -> 0
                label.startsWith(normalizedQuery) -> 1
                compactLabel.startsWith(compactQuery) -> 2
                label.contains(normalizedQuery) -> 3
                compactLabel.contains(compactQuery) -> 4
                packageName.contains(normalizedQuery) -> 5
                else -> 100
            }
            app to score
        }
        .filter { (_, score) -> score < 100 }
        .sortedWith(compareBy({ it.second }, { it.first.label.lowercase() }))
        .map { it.first }
}

private fun grayscaleFilter(): ColorFilter {
    val matrix = ColorMatrix(
        floatArrayOf(
            0.2126f, 0.7152f, 0.0722f, 0f, 0f,
            0.2126f, 0.7152f, 0.0722f, 0f, 0f,
            0.2126f, 0.7152f, 0.0722f, 0f, 0f,
            0f, 0f, 0f, 1f, 0f
        )
    )
    return ColorFilter.colorMatrix(matrix)
}

@Composable
private fun BackChevron(size: Dp) {
    Canvas(modifier = Modifier.size(size)) {
        val strokeWidth = size.toPx() * 0.13f
        drawLine(
            color = Color(0xFF0A84FF),
            start = androidx.compose.ui.geometry.Offset(this.size.width * 0.65f, this.size.height * 0.18f),
            end = androidx.compose.ui.geometry.Offset(this.size.width * 0.30f, this.size.height * 0.50f),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Round
        )
        drawLine(
            color = Color(0xFF0A84FF),
            start = androidx.compose.ui.geometry.Offset(this.size.width * 0.30f, this.size.height * 0.50f),
            end = androidx.compose.ui.geometry.Offset(this.size.width * 0.65f, this.size.height * 0.82f),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Round
        )
    }
}

@Composable
private fun SearchIcon(size: Dp) {
    Canvas(modifier = Modifier.size(size)) {
        val strokeWidth = size.toPx() * 0.12f
        drawCircle(
            color = Color(0xFF9B9BA3),
            radius = this.size.minDimension * 0.28f,
            center = androidx.compose.ui.geometry.Offset(this.size.width * 0.43f, this.size.height * 0.43f),
            style = androidx.compose.ui.graphics.drawscope.Stroke(width = strokeWidth)
        )
        drawLine(
            color = Color(0xFF9B9BA3),
            start = androidx.compose.ui.geometry.Offset(this.size.width * 0.63f, this.size.height * 0.63f),
            end = androidx.compose.ui.geometry.Offset(this.size.width * 0.84f, this.size.height * 0.84f),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Round
        )
    }
}

@Composable
private fun CheckMark(size: Dp) {
    Canvas(modifier = Modifier.size(size)) {
        val strokeWidth = size.toPx() * 0.18f
        drawLine(
            color = Color.White,
            start = androidx.compose.ui.geometry.Offset(this.size.width * 0.18f, this.size.height * 0.48f),
            end = androidx.compose.ui.geometry.Offset(this.size.width * 0.42f, this.size.height * 0.72f),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Round
        )
        drawLine(
            color = Color.White,
            start = androidx.compose.ui.geometry.Offset(this.size.width * 0.42f, this.size.height * 0.72f),
            end = androidx.compose.ui.geometry.Offset(this.size.width * 0.84f, this.size.height * 0.28f),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Round
        )
    }
}

private data class BlockAppsLayoutMetrics(
    val titleTextSize: Float,
    val bodyTextSize: Float,
    val navTextSize: Float,
    val buttonTextSize: Float,
    val searchTextSize: Float,
    val appLabelTextSize: Float,
    val topIconSize: Dp,
    val topBarToTitleGap: Dp,
    val titleToCountGap: Dp,
    val countToSearchGap: Dp,
    val searchToGridGap: Dp,
    val searchHeight: Dp,
    val searchRadius: Dp,
    val searchHorizontalPadding: Dp,
    val searchIconSize: Dp,
    val searchIconGap: Dp,
    val appIconSize: Dp,
    val appIconRadius: Dp,
    val checkSize: Dp,
    val checkIconSize: Dp,
    val appLabelGap: Dp,
    val gridColumnGap: Dp,
    val gridRowGap: Dp,
    val gridBottomPadding: Dp,
    val gridToButtonGap: Dp,
    val startButtonHeight: Dp,
    val startButtonRadius: Dp
) {
    companion object {
        operator fun invoke(contentWidth: Dp, contentHeight: Dp): BlockAppsLayoutMetrics {
            val widthScale = contentWidth.value / 328f
            val heightScale = contentHeight.value / 760f
            val scale = max(0.64f, minOf(widthScale, heightScale, 1f))

            return BlockAppsLayoutMetrics(
                titleTextSize = 40f * scale,
                bodyTextSize = 22f * scale,
                navTextSize = 20f * scale,
                buttonTextSize = 22f * scale,
                searchTextSize = 24f * scale,
                appLabelTextSize = 15f * scale,
                topIconSize = (30f * scale).dp,
                topBarToTitleGap = (40f * scale).dp,
                titleToCountGap = (10f * scale).dp,
                countToSearchGap = (26f * scale).dp,
                searchToGridGap = (30f * scale).dp,
                searchHeight = (64f * scale).dp,
                searchRadius = (18f * scale).dp,
                searchHorizontalPadding = (18f * scale).dp,
                searchIconSize = (26f * scale).dp,
                searchIconGap = (10f * scale).dp,
                appIconSize = (74f * scale).dp,
                appIconRadius = (16f * scale).dp,
                checkSize = (24f * scale).dp,
                checkIconSize = (17f * scale).dp,
                appLabelGap = (8f * scale).dp,
                gridColumnGap = (24f * scale).dp,
                gridRowGap = (28f * scale).dp,
                gridBottomPadding = (10f * scale).dp,
                gridToButtonGap = (18f * scale).dp,
                startButtonHeight = (70f * scale).dp,
                startButtonRadius = (16f * scale).dp
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
fun BlockerSetupPreview() {
    MyApplicationTheme {
        BlockerSetupScreen()
    }
}
