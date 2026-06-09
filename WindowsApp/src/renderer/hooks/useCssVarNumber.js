import { useEffect, useState } from "react";

let probeElement = null;

function getProbeElement() {
    if (probeElement && document.body.contains(probeElement)) {
        return probeElement;
    }

    probeElement = document.createElement("div");
    probeElement.setAttribute("aria-hidden", "true");
    probeElement.style.cssText =
        "position:absolute;visibility:hidden;pointer-events:none;top:0;left:0;height:0;width:0;overflow:hidden;";
    document.body.appendChild(probeElement);
    return probeElement;
}

function readCssVarNumber(name, fallback) {
    const probe = getProbeElement();
    probe.style.height = `var(${name})`;
    const parsed = parseFloat(getComputedStyle(probe).height);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export default function useCssVarNumber(name, fallback) {
    const [value, setValue] = useState(() => readCssVarNumber(name, fallback));

    useEffect(() => {
        function update() {
            setValue(readCssVarNumber(name, fallback));
        }

        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, [name, fallback]);

    return value;
}
