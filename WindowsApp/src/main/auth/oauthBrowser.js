const { shell } = require("electron");
const http = require("http");
const { getOAuthRedirectUrl, OAUTH_REDIRECT_URL } = require("./oauthConfig");

let localOAuthServer = null;
let oauthInProgress = false;

function parseCallbackUrl(url) {
    const parsed = new URL(url);
    const isLocalCallback =
        parsed.protocol === "http:" &&
        parsed.hostname === "127.0.0.1" &&
        parsed.pathname === "/auth/callback";

    if (!isLocalCallback) return null;

    const hash = parsed.hash?.startsWith("#") ? parsed.hash.slice(1) : "";
    if (hash) {
        const params = new URLSearchParams(hash);
        const access_token = params.get("access_token");
        if (access_token) {
            return {
                access_token,
                refresh_token: params.get("refresh_token"),
            };
        }
    }

    const code = parsed.searchParams.get("code");
    if (code) return { code };

    const error =
        parsed.searchParams.get("error_description") ||
        parsed.searchParams.get("error");
    if (error) {
        const err = new Error(error);
        err.name = "OAuthError";
        throw err;
    }

    return null;
}

function stopLocalOAuthServer() {
    if (!localOAuthServer) return;
    localOAuthServer.close();
    localOAuthServer = null;
}

function waitForLocalCallback(timeoutMs = 300000) {
    stopLocalOAuthServer();

    return new Promise((resolve, reject) => {
        const redirectUrl = OAUTH_REDIRECT_URL;
        const expected = new URL(redirectUrl);

        const server = http.createServer((req, res) => {
            let reqUrl;
            try {
                reqUrl = new URL(req.url || "/", redirectUrl);
            } catch {
                res.writeHead(400);
                res.end();
                return;
            }

            if (reqUrl.pathname !== expected.pathname) {
                res.writeHead(404);
                res.end();
                return;
            }

            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(
                "<!DOCTYPE html><html><body><p>Signed in. You can close this tab and return to Tether.</p></body></html>"
            );

            stopLocalOAuthServer();

            try {
                const result = parseCallbackUrl(reqUrl.href);
                if (!result) {
                    reject(new Error("Invalid sign-in response."));
                    return;
                }
                resolve(result);
            } catch (err) {
                reject(err);
            }
        });

        server.on("error", (err) => {
            stopLocalOAuthServer();
            reject(err);
        });

        localOAuthServer = server.listen(expected.port, expected.hostname, () => {});

        const timer = setTimeout(() => {
            stopLocalOAuthServer();
            reject(new Error("Google sign-in timed out."));
        }, timeoutMs);

        server.on("close", () => clearTimeout(timer));
    });
}

async function openInDefaultBrowser(url) {
    if (!url.startsWith("https://")) {
        throw new Error("Invalid OAuth URL.");
    }
    await shell.openExternal(url);
}

async function startBrowserOAuth(authUrl) {
    if (oauthInProgress) {
        throw new Error("Sign-in already in progress.");
    }

    oauthInProgress = true;
    const callbackPromise = waitForLocalCallback();

    try {
        await openInDefaultBrowser(authUrl);
        return await callbackPromise;
    } catch (err) {
        stopLocalOAuthServer();
        throw err;
    } finally {
        oauthInProgress = false;
    }
}

module.exports = { getOAuthRedirectUrl, startBrowserOAuth };
