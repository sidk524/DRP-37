import { useEffect, useState } from "react";

export function useAuthSession() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        if (!window.tether?.getSession) {
            setLoading(false);
            return undefined;
        }

        window.tether.getSession().then((currentSession) => {
            if (!mounted) return;
            setSession(currentSession);
            setLoading(false);
        });

        const unsub = window.tether.onAuthStateChange((newSession) => {
            setSession(newSession);
            setLoading(false);
        });

        return () => {
            mounted = false;
            unsub();
        };
    }, []);

    return { session, loading };
}
