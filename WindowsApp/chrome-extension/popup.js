const statusEl = document.getElementById("status");
const domainsEl = document.getElementById("domains");

function renderList(items = []) {
    domainsEl.hidden = !items.length;
    domainsEl.textContent = "";
    for (const item of items) {
        const li = document.createElement("li");
        li.textContent = item;
        domainsEl.appendChild(li);
    }
}

chrome.storage.local.get(["connected", "blocking", "domains", "hosts", "rules", "endsAt", "lastError"], (data) => {
    if (!data.connected) {
        statusEl.className = "err";
        statusEl.textContent = data.lastError || "Desktop app not reachable. Start Tether with npm run dev.";
        return;
    }
    if (data.lastError) {
        statusEl.className = "err";
        statusEl.textContent = data.lastError;
        renderList(data.domains || []);
        return;
    }
    if (!data.blocking) {
        statusEl.className = "warn";
        statusEl.textContent = "Connected. No active block session.";
        return;
    }
    statusEl.className = "ok";
    const ends = data.endsAt ? new Date(data.endsAt).toLocaleTimeString() : "";
    statusEl.textContent = ends
        ? `Blocking until ${ends}`
        : "Blocking active websites.";
    renderList(data.hosts?.length ? data.hosts : data.domains);
});
