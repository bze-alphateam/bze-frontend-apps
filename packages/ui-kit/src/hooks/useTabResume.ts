import {useEffect, useRef} from "react";
import {watchTabResume, type ResumeEvent, type ResumeEventType, type ResumeTarget} from "../service/tab_resume";

const DEFAULT_MIN_HIDDEN_MS = 30_000;

// visibilitychange is dispatched on document, pageshow on window
const browserTarget = (): ResumeTarget => ({
    get visibilityState() { return document.visibilityState; },
    addEventListener: (type: ResumeEventType, fn: (ev: ResumeEvent) => void) =>
        (type === 'pageshow' ? window : document).addEventListener(type, fn as EventListener),
    removeEventListener: (type: ResumeEventType, fn: (ev: ResumeEvent) => void) =>
        (type === 'pageshow' ? window : document).removeEventListener(type, fn as EventListener),
});

/** Calls the latest onResume when the tab returns to the foreground after minHiddenMs hidden (or from the bfcache). */
export const useTabResume = (onResume: () => void, minHiddenMs: number = DEFAULT_MIN_HIDDEN_MS): void => {
    const latest = useRef(onResume);
    useEffect(() => {
        latest.current = onResume;
    }, [onResume]);

    useEffect(() => {
        if (typeof document === 'undefined' || typeof window === 'undefined') return;

        return watchTabResume(
            {target: browserTarget(), now: Date.now, minHiddenMs},
            () => latest.current(),
        );
    }, [minHiddenMs]);
};
