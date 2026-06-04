import { useEffect, useState } from "react";
import { supabase } from "../services/SupabaseClient";

// Session as the single source of truth — mirrors the Android MainActivity,
// which collects auth.sessionStatus and swaps screens reactively. The whole UI
// gate keys off this: signing in/out automatically flips the rendered screen,
// no manual navigation needed.
export function useAuthSession() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        supabase.auth.getSession().then(({ data }) => {
            if (!mounted) return;
            setSession(data.session);
            setLoading(false);
        });

        const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
            setSession(newSession);
            setLoading(false);
        });

        return () => {
            mounted = false;
            sub.subscription.unsubscribe();
        };
    }, []);

    return { session, loading };
}
