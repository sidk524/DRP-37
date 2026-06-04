// Website blocking via the system hosts file.
//
// For Hard sessions, blocked domains are redirected to loopback so the browser
// can't reach them — system-wide, every browser, no extension needed. We write
// our entries inside a clearly marked block so we can cleanly remove exactly
// our lines (and nobody else's) when the session ends.
//
// Editing the hosts file requires administrator rights. If Tether isn't
// elevated the write fails and we report that back rather than crashing.

const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const HOSTS_PATH =
    process.platform === "win32"
        ? path.join(process.env.WINDIR || "C:\\Windows", "System32", "drivers", "etc", "hosts")
        : "/etc/hosts";

const START_MARKER = "# === TETHER BLOCK START (do not edit) ===";
const END_MARKER = "# === TETHER BLOCK END ===";

// Remove a previously written Tether block (if any), returning the rest.
function stripTetherBlock(content) {
    const start = content.indexOf(START_MARKER);
    const end = content.indexOf(END_MARKER);
    if (start === -1 || end === -1 || end < start) return content;
    const before = content.slice(0, start).replace(/\s+$/, "");
    const after = content.slice(end + END_MARKER.length).replace(/^\s+/, "");
    return [before, after].filter(Boolean).join("\n");
}

// Normalize a domain ("https://www.x.com/" -> "x.com") and expand to the apex
// plus www. host, blocked on both IPv4 and IPv6 loopback.
function expand(domains) {
    const hosts = new Set();
    for (const raw of domains || []) {
        const d = String(raw)
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/^www\./, "")
            .replace(/\/.*$/, "");
        if (!d) continue;
        hosts.add(d);
        hosts.add(`www.${d}`);
    }
    return [...hosts];
}

function buildBlock(hosts) {
    const lines = [START_MARKER];
    for (const h of hosts) {
        lines.push(`127.0.0.1 ${h}`);
        lines.push(`::1 ${h}`);
    }
    lines.push(END_MARKER);
    return lines.join("\n");
}

// Browsers and the OS cache DNS; flush so the block takes effect immediately.
function flushDns() {
    if (process.platform === "win32") exec("ipconfig /flushdns", () => {});
}

// Add the blocked domains to the hosts file. Idempotent: any existing Tether
// block is replaced. Returns { ok, blocked } or { ok:false, error }.
function blockDomains(domains) {
    const hosts = expand(domains);
    if (hosts.length === 0) return { ok: true, blocked: [] };

    let content;
    try {
        content = fs.readFileSync(HOSTS_PATH, "utf8");
    } catch (err) {
        return { ok: false, error: `Couldn't read the hosts file: ${err.message}` };
    }

    const next = `${stripTetherBlock(content).replace(/\s+$/, "")}\n\n${buildBlock(hosts)}\n`;
    try {
        fs.writeFileSync(HOSTS_PATH, next, "utf8");
    } catch (err) {
        const needsAdmin = err.code === "EPERM" || err.code === "EACCES";
        return {
            ok: false,
            error: needsAdmin
                ? "Website blocking needs Tether to run as administrator."
                : `Couldn't update the hosts file: ${err.message}`,
        };
    }

    flushDns();
    return { ok: true, blocked: hosts };
}

// Remove the Tether block from the hosts file. Safe to call when none exists.
function unblockDomains() {
    let content;
    try {
        content = fs.readFileSync(HOSTS_PATH, "utf8");
    } catch {
        return { ok: false };
    }
    if (!content.includes(START_MARKER)) return { ok: true };

    try {
        fs.writeFileSync(HOSTS_PATH, `${stripTetherBlock(content).replace(/\s+$/, "")}\n`, "utf8");
    } catch (err) {
        return { ok: false, error: err.message };
    }
    flushDns();
    return { ok: true };
}

module.exports = { blockDomains, unblockDomains, HOSTS_PATH };
