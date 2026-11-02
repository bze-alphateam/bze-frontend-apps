/**
 * Detects a tab coming back to the foreground, so data can be refreshed at the moment the
 * user looks at it again (background tabs get throttled timers and may be frozen).
 */

export type ResumeEvent = {persisted?: boolean};
export type ResumeEventType = 'visibilitychange' | 'pageshow';

/** The subset of document/window used. */
export interface ResumeTarget {
    readonly visibilityState: 'visible' | 'hidden' | string;
    addEventListener(type: ResumeEventType, fn: (ev: ResumeEvent) => void): void;
    removeEventListener(type: ResumeEventType, fn: (ev: ResumeEvent) => void): void;
}

export interface TabResumeDeps {
    target: ResumeTarget;
    now: () => number;
    minHiddenMs: number;
}

// visibilitychange and pageshow can both fire for one resume; one resume = one callback.
const DUPLICATE_WINDOW_MS = 1_000;

/** Calls onResume when the tab was hidden for at least minHiddenMs, or restored from the bfcache. */
export const watchTabResume = (deps: TabResumeDeps, onResume: () => void): (() => void) => {
    const {target, now, minHiddenMs} = deps;
    let hiddenAt: number | null = target.visibilityState === 'hidden' ? now() : null;
    let lastResumeAt: number | null = null;

    const resume = () => {
        const at = now();
        hiddenAt = null;
        if (lastResumeAt !== null && at - lastResumeAt < DUPLICATE_WINDOW_MS) return;
        lastResumeAt = at;
        onResume();
    };

    const onVisibility = () => {
        if (target.visibilityState === 'hidden') {
            if (hiddenAt === null) hiddenAt = now();
            return;
        }
        const wasHiddenFor = hiddenAt === null ? 0 : now() - hiddenAt;
        if (hiddenAt !== null && wasHiddenFor >= minHiddenMs) {
            resume();
        } else {
            hiddenAt = null;
        }
    };

    const onPageShow = (ev: ResumeEvent) => {
        if (ev.persisted === true) resume();
    };

    target.addEventListener('visibilitychange', onVisibility);
    target.addEventListener('pageshow', onPageShow);

    return () => {
        target.removeEventListener('visibilitychange', onVisibility);
        target.removeEventListener('pageshow', onPageShow);
    };
};
