import {useEffect, useState} from "react";
import {blockchainEventManager, getAutomationPaused, invalidateAutomationPaused} from "@bze/bze-ui-kit";
import {AUTOMATION_PAUSE_CHANGED_EVENT} from "@/lib/automation-pause";

const POLL_INTERVAL_MS = 60_000;

/**
 * Whether the guardian paused the burner's automation (chain v8.3.0). Read on mount, every 60 s
 * (the fallback) and right after a pause / resume event. `false` on v8.2.0 nodes and on failures.
 */
export function useAutomationPaused(): boolean {
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const value = await getAutomationPaused();
            if (!cancelled) setPaused(value);
        };

        void load();
        const interval = setInterval(() => void load(), POLL_INTERVAL_MS);
        const unsubscribe = blockchainEventManager.subscribe(AUTOMATION_PAUSE_CHANGED_EVENT, () => {
            invalidateAutomationPaused();
            void load();
        });

        return () => {
            cancelled = true;
            clearInterval(interval);
            unsubscribe();
        };
    }, []);

    return paused;
}
