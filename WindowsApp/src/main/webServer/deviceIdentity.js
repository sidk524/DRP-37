const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { app } = require("electron");

// A stable per-install device id, used so the web server can suppress echoing a
// device's own session changes back to it over the sync WebSocket.
let cached = null;

function deviceIdPath() {
    return path.join(app.getPath("userData"), "tether-device-id");
}

function getDeviceId() {
    if (cached) return cached;

    try {
        const stored = fs.readFileSync(deviceIdPath(), "utf8").trim();
        if (stored) {
            cached = stored;
            return cached;
        }
    } catch {
        /* not created yet */
    }

    cached = randomUUID();
    try {
        fs.mkdirSync(path.dirname(deviceIdPath()), { recursive: true });
        fs.writeFileSync(deviceIdPath(), cached, "utf8");
    } catch (err) {
        console.warn(`[device-identity] could not persist device id: ${err?.message || err}`);
    }
    return cached;
}

module.exports = { getDeviceId };
