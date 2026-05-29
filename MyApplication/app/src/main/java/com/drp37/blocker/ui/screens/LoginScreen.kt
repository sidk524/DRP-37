package com.drp37.blocker.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.drp37.blocker.ui.theme.MyApplicationTheme
import kotlin.math.max

@Composable
fun LoginScreen() {
    LoginScreen(
        isLoading = false,
        errorMessage = null,
        onEmailLogin = { _, _ -> },
        onGoogleLogin = {}
    )
}

@Composable
fun LoginScreen(
    isLoading: Boolean,
    errorMessage: String?,
    onEmailLogin: (email: String, password: String) -> Unit,
    onGoogleLogin: () -> Unit
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var authMode by remember { mutableStateOf(AuthMode.Login) }
    val canSubmit = email.isNotBlank() && password.isNotBlank() && !isLoading
    val isLogin = authMode == AuthMode.Login

    Surface(modifier = Modifier.fillMaxSize(), color = Color.Black) {
        BoxWithConstraints(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            val contentHeight = maxHeight * 0.80f
            val contentWidth = (maxWidth * 0.84f).coerceAtMost(560.dp)
            val layout = remember(contentWidth, contentHeight) {
                LoginLayoutMetrics(
                    contentWidth = contentWidth,
                    contentHeight = contentHeight
                )
            }

            Column(
                modifier = Modifier
                    .width(contentWidth)
                    .height(contentHeight),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    TetherLogo(layout = layout)

                    Spacer(modifier = Modifier.height(layout.logoToTitleGap))

                    Text(
                        text = if (isLogin) "Welcome back!!!" else "Create an account",
                        color = Color.White,
                        fontSize = layout.titleTextSize.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.sp,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(layout.titleToSubtitleGap))

                    Text(
                        text = if (isLogin) {
                            "Log in to continue your focus journey"
                        } else {
                            "Enter your email to sign up for Tether"
                        },
                        color = Color(0xFF8F8F95),
                        fontSize = layout.bodyTextSize.sp,
                        letterSpacing = 0.sp,
                        textAlign = TextAlign.Center
                    )
                }

                Spacer(modifier = Modifier.height(layout.headerToFormGap))

                Column(modifier = Modifier.fillMaxWidth()) {
                    LoginTextField(
                        value = email,
                        placeholder = "email@domain.com",
                        keyboardType = KeyboardType.Email,
                        layout = layout,
                        onValueChange = { email = it }
                    )

                    Spacer(modifier = Modifier.height(layout.fieldGap))

                    LoginTextField(
                        value = password,
                        placeholder = "Password",
                        keyboardType = KeyboardType.Password,
                        isPassword = true,
                        layout = layout,
                        onValueChange = { password = it }
                    )

                    Spacer(modifier = Modifier.height(layout.passwordToButtonGap))

                    Button(
                        onClick = {
                            if (isLogin) {
                                onEmailLogin(email.trim(), password)
                            }
                        },
                        enabled = isLogin && canSubmit,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(layout.controlHeight),
                        shape = RoundedCornerShape(layout.cornerRadius),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF2B2B30),
                            contentColor = Color.White,
                            disabledContainerColor = Color(0xFF1F1F22),
                            disabledContentColor = Color(0xFF5F5F65)
                        )
                    ) {
                        Text(
                            text = when {
                                isLoading -> "Logging in"
                                isLogin -> "Log in"
                                else -> "Continue"
                            },
                            fontSize = layout.buttonTextSize.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.sp
                        )
                    }

                    Spacer(modifier = Modifier.height(layout.buttonToDividerGap))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        HorizontalDivider(
                            modifier = Modifier.weight(1f),
                            color = Color(0xFF1D1D20),
                            thickness = 1.dp
                        )
                        Text(
                            text = "or",
                            color = Color(0xFF9B9BA1),
                            fontSize = layout.smallTextSize.sp,
                            modifier = Modifier.padding(horizontal = layout.dividerTextPadding)
                        )
                        HorizontalDivider(
                            modifier = Modifier.weight(1f),
                            color = Color(0xFF1D1D20),
                            thickness = 1.dp
                        )
                    }

                    Spacer(modifier = Modifier.height(layout.dividerToGoogleGap))

                    Button(
                        onClick = onGoogleLogin,
                        enabled = !isLoading,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(layout.controlHeight),
                        shape = RoundedCornerShape(layout.cornerRadius),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF1F1F22),
                            contentColor = Color.White
                        )
                    ) {
                        GoogleMark(markSize = layout.googleMarkSize)
                        Spacer(modifier = Modifier.width(layout.googleTextGap))
                        Text(
                            text = "Continue with Google",
                            fontSize = layout.googleTextSize.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.sp,
                            maxLines = 1
                        )
                    }

                    if (errorMessage != null) {
                        Spacer(modifier = Modifier.height(layout.errorGap))
                        Text(
                            text = errorMessage,
                            color = Color(0xFFFF6B6B),
                            fontSize = layout.smallTextSize.sp,
                            lineHeight = layout.errorLineHeight.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }

                Spacer(modifier = Modifier.height(layout.formToSignupGap))

                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Row(
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (isLogin) "Don't have an account?" else "Already have an account?",
                            color = Color(0xFF8F8F95),
                            fontSize = layout.bodyTextSize.sp
                        )
                        TextButton(
                            onClick = {
                                authMode = if (isLogin) AuthMode.SignUp else AuthMode.Login
                                email = ""
                                password = ""
                            }
                        ) {
                            Text(
                                text = if (isLogin) "Sign up" else "Log in",
                                color = Color(0xFF0A84FF),
                                fontSize = layout.bodyTextSize.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                }

                Spacer(modifier = Modifier.weight(1f))

                TermsText(layout = layout)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LoginTextField(
    value: String,
    placeholder: String,
    keyboardType: KeyboardType,
    isPassword: Boolean = false,
    layout: LoginLayoutMetrics,
    onValueChange: (String) -> Unit
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier
            .fillMaxWidth()
            .height(layout.controlHeight),
        singleLine = true,
        placeholder = {
            Text(
                text = placeholder,
                color = Color(0xFFA4A4AA),
                fontSize = layout.inputTextSize.sp
            )
        },
        textStyle = androidx.compose.ui.text.TextStyle(
            color = Color.White,
            fontSize = layout.inputTextSize.sp
        ),
        visualTransformation = if (isPassword) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        shape = RoundedCornerShape(layout.cornerRadius),
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = Color(0xFF1F1F22),
            unfocusedContainerColor = Color(0xFF1F1F22),
            disabledContainerColor = Color(0xFF1F1F22),
            focusedBorderColor = Color.Transparent,
            unfocusedBorderColor = Color.Transparent,
            cursorColor = Color.White
        )
    )
}

@Composable
private fun GoogleMark(markSize: Dp) {
    Canvas(modifier = Modifier.size(markSize)) {
        val strokeWidth = size.minDimension * 0.16f
        val stroke = Stroke(width = strokeWidth, cap = StrokeCap.Square)
        val inset = strokeWidth / 2
        val arcSize = size.copy(
            width = size.width - strokeWidth,
            height = size.height - strokeWidth
        )

        drawArc(
            color = Color(0xFF4285F4),
            startAngle = -35f,
            sweepAngle = 95f,
            useCenter = false,
            topLeft = androidx.compose.ui.geometry.Offset(inset, inset),
            size = arcSize,
            style = stroke
        )
        drawArc(
            color = Color(0xFF34A853),
            startAngle = 60f,
            sweepAngle = 75f,
            useCenter = false,
            topLeft = androidx.compose.ui.geometry.Offset(inset, inset),
            size = arcSize,
            style = stroke
        )
        drawArc(
            color = Color(0xFFFBBC05),
            startAngle = 135f,
            sweepAngle = 80f,
            useCenter = false,
            topLeft = androidx.compose.ui.geometry.Offset(inset, inset),
            size = arcSize,
            style = stroke
        )
        drawArc(
            color = Color(0xFFEA4335),
            startAngle = 215f,
            sweepAngle = 110f,
            useCenter = false,
            topLeft = androidx.compose.ui.geometry.Offset(inset, inset),
            size = arcSize,
            style = stroke
        )
        drawLine(
            color = Color(0xFF4285F4),
            start = androidx.compose.ui.geometry.Offset(size.width * 0.52f, size.height * 0.5f),
            end = androidx.compose.ui.geometry.Offset(size.width * 0.92f, size.height * 0.5f),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Square
        )
        drawLine(
            color = Color(0xFF4285F4),
            start = androidx.compose.ui.geometry.Offset(size.width * 0.92f, size.height * 0.5f),
            end = androidx.compose.ui.geometry.Offset(size.width * 0.82f, size.height * 0.72f),
            strokeWidth = strokeWidth,
            cap = StrokeCap.Square
        )
    }
}

@Composable
private fun TetherLogo(layout: LoginLayoutMetrics) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = "tet",
            color = Color.White,
            fontSize = layout.logoTextSize.sp,
            fontWeight = FontWeight.Light,
            letterSpacing = 0.sp
        )
        Canvas(
            modifier = Modifier
                .size(width = layout.logoHWidth, height = layout.logoHHeight)
                .padding(horizontal = 1.dp)
        ) {
            val lineColor = Color(0xFFE6E6E6)
            val stroke = 1.6.dp.toPx()
            val left = size.width * 0.18f
            val right = size.width * 0.82f
            val top = size.height * 0.08f
            val bottom = size.height * 0.92f
            val centerY = size.height * 0.5f

            drawLine(lineColor, androidx.compose.ui.geometry.Offset(left, top), androidx.compose.ui.geometry.Offset(left, bottom), stroke)
            drawLine(lineColor, androidx.compose.ui.geometry.Offset(right, top), androidx.compose.ui.geometry.Offset(right, bottom), stroke)
            drawLine(lineColor, androidx.compose.ui.geometry.Offset(left, centerY), androidx.compose.ui.geometry.Offset(right, centerY), stroke)
        }
        Text(
            text = "er",
            color = Color.White,
            fontSize = layout.logoTextSize.sp,
            fontWeight = FontWeight.Light,
            letterSpacing = 0.sp
        )
    }
}

@Composable
private fun TermsText(layout: LoginLayoutMetrics) {
    Text(
        text = buildAnnotatedString {
            append("By clicking continue, you agree to our ")
            withStyle(SpanStyle(textDecoration = TextDecoration.Underline)) {
                append("Terms of Service")
            }
            append("\nand ")
            withStyle(SpanStyle(textDecoration = TextDecoration.Underline)) {
                append("Privacy Policy")
            }
        },
        color = Color(0xFF55555A),
        fontSize = layout.termsTextSize.sp,
        lineHeight = layout.termsLineHeight.sp,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(bottom = layout.termsBottomPadding)
    )
}

private data class LoginLayoutMetrics(
    val controlHeight: Dp,
    val cornerRadius: Dp,
    val logoTextSize: Float,
    val logoHWidth: Dp,
    val logoHHeight: Dp,
    val titleTextSize: Float,
    val bodyTextSize: Float,
    val inputTextSize: Float,
    val buttonTextSize: Float,
    val googleTextSize: Float,
    val smallTextSize: Float,
    val termsTextSize: Float,
    val termsLineHeight: Float,
    val googleMarkSize: Dp,
    val googleTextGap: Dp,
    val dividerTextPadding: Dp,
    val logoToTitleGap: Dp,
    val titleToSubtitleGap: Dp,
    val headerToFormGap: Dp,
    val fieldGap: Dp,
    val passwordToButtonGap: Dp,
    val buttonToDividerGap: Dp,
    val dividerToGoogleGap: Dp,
    val formToSignupGap: Dp,
    val errorGap: Dp,
    val errorLineHeight: Float,
    val termsBottomPadding: Dp
) {
    companion object {
        operator fun invoke(contentWidth: Dp, contentHeight: Dp): LoginLayoutMetrics {
            val widthScale = contentWidth.value / 328f
            val heightScale = contentHeight.value / 675f
            val scale = minOf(widthScale, heightScale, 1f)
            val compactScale = max(0.58f, scale)

            return LoginLayoutMetrics(
                controlHeight = (64f * compactScale).dp,
                cornerRadius = (18f * compactScale).dp,
                logoTextSize = 43f * compactScale,
                logoHWidth = (34f * compactScale).dp,
                logoHHeight = (44f * compactScale).dp,
                titleTextSize = 36f * compactScale,
                bodyTextSize = 18f * compactScale,
                inputTextSize = 20f * compactScale,
                buttonTextSize = 20f * compactScale,
                googleTextSize = 21f * compactScale,
                smallTextSize = 16f * compactScale,
                termsTextSize = 15f * compactScale,
                termsLineHeight = 21f * compactScale,
                googleMarkSize = (30f * compactScale).dp,
                googleTextGap = (16f * compactScale).dp,
                dividerTextPadding = (22f * compactScale).dp,
                logoToTitleGap = (48f * compactScale).dp,
                titleToSubtitleGap = (14f * compactScale).dp,
                headerToFormGap = (44f * compactScale).dp,
                fieldGap = (14f * compactScale).dp,
                passwordToButtonGap = (16f * compactScale).dp,
                buttonToDividerGap = (28f * compactScale).dp,
                dividerToGoogleGap = (28f * compactScale).dp,
                formToSignupGap = (38f * compactScale).dp,
                errorGap = (12f * compactScale).dp,
                errorLineHeight = 18f * compactScale,
                termsBottomPadding = 0.dp
            )
        }
    }
}

private enum class AuthMode {
    Login,
    SignUp
}


@Preview(showBackground = true)
@Composable
private fun LoginScreenPreview() {
    MyApplicationTheme {
        LoginScreen()
    }
}
