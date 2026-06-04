const OAUTH_REDIRECT_URL = "http://127.0.0.1:17892/auth/callback";

function getOAuthRedirectUrl() {
    return OAUTH_REDIRECT_URL;
}

module.exports = { OAUTH_REDIRECT_URL, getOAuthRedirectUrl };
