import { useLayoutEffect, useRef, useState } from "react";
import "../styles/AppChrome.css";

const imageSrc = (name) => `${import.meta.env.BASE_URL}images/${name}`;

const EDGE_ART = [
    { src: imageSrc("image2.png"), slot: "top-left" },
    { src: imageSrc("image5.png"), slot: "top-right" },
    { src: imageSrc("image4.png"), slot: "top-center" },
    { src: imageSrc("image.png"), slot: "bottom-left" },
    { src: imageSrc("image6.png"), slot: "bottom-right" },
    { src: imageSrc("image3.png"), slot: "bottom-center" },
];

function useChromeArtVisibility(rootRef) {
    const [hidden, setHidden] = useState(false);
    const [compact, setCompact] = useState(false);

    useLayoutEffect(() => {
        const root = rootRef.current;
        if (!root) return undefined;

        const update = () => {
            const width = root.clientWidth;
            const height = root.clientHeight;
            if (width === 0) return;

            setHidden(width < 720 || height < 520);
            setCompact(width < 1000 || height < 640);
        };

        update();
        const observer = new ResizeObserver(update);
        observer.observe(root);
        return () => observer.disconnect();
    }, [rootRef]);

    return { hidden, compact };
}

function AppChrome({ children }) {
    const rootRef = useRef(null);
    const { hidden, compact } = useChromeArtVisibility(rootRef);

    const rootClass = [
        "app-chrome",
        hidden && "app-chrome--no-art",
        compact && "app-chrome--compact",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div ref={rootRef} className={rootClass}>
            {!hidden && (
                <div className="app-chrome-art-layer" aria-hidden="true">
                    {EDGE_ART.map((item) => (
                        <img
                            key={item.slot}
                            src={item.src}
                            className={`app-chrome-deco app-chrome-deco--${item.slot}`}
                            alt=""
                        />
                    ))}
                </div>
            )}
            <main className="app-chrome-main">{children}</main>
        </div>
    );
}

export default AppChrome;
