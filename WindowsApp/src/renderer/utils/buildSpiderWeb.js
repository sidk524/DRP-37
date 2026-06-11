const NS = "http://www.w3.org/2000/svg";
const CX = 340;
const CY = 210;
const HUB = 54;
const HALF = 110;
const angles = [0, 45, 90, 135, 180, 225, 270, 315];
const tearSpokes = { 45: 1, 90: 1 };

function rad(d) {
    return (d * Math.PI) / 180;
}

function mk(web, tag, attrs, tear) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", "#F4F6F8");
    el.setAttribute("stroke-width", "2.4");
    el.setAttribute("stroke-linecap", "round");
    el.setAttribute("opacity", "0.95");
    if (tear) el.setAttribute("class", "tear");
    web.appendChild(el);
}

export function buildSpiderWeb(web) {
    if (!web) return;

    while (web.firstChild) web.removeChild(web.firstChild);

    angles.forEach((d) => {
        const a = rad(d);
        const c = Math.cos(a);
        const s = Math.sin(a);
        const tx = Math.abs(c) > 1e-6 ? HALF / Math.abs(c) : 1e9;
        const ty = Math.abs(s) > 1e-6 ? HALF / Math.abs(s) : 1e9;
        const t = Math.min(tx, ty);
        mk(
            web,
            "line",
            {
                x1: (CX + c * HUB).toFixed(1),
                y1: (CY + s * HUB).toFixed(1),
                x2: (CX + c * t).toFixed(1),
                y2: (CY + s * t).toFixed(1),
            },
            !!tearSpokes[d]
        );
    });

    const rings = [74, 102];
    const tearRings = { 102: { 0: 1, 45: 1, 90: 1 }, 74: { 45: 1 } };
    rings.forEach((r) => {
        for (let i = 0; i < angles.length; i++) {
            const d1 = angles[i];
            const d2 = angles[(i + 1) % angles.length];
            const a1 = rad(d1);
            const a2 = rad(d2);
            const p1 = [CX + Math.cos(a1) * r, CY + Math.sin(a1) * r];
            const p2 = [CX + Math.cos(a2) * r, CY + Math.sin(a2) * r];
            const mx = (p1[0] + p2[0]) / 2;
            const my = (p1[1] + p2[1]) / 2;
            const qx = mx + (CX - mx) * 0.16;
            const qy = my + (CY - my) * 0.16;
            const tear = tearRings[String(r)] && tearRings[String(r)][d1];
            mk(
                web,
                "path",
                {
                    d: `M${p1[0].toFixed(1)},${p1[1].toFixed(1)} Q${qx.toFixed(1)},${qy.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`,
                },
                !!tear
            );
        }
    });
}
