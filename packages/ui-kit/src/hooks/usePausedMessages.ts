'use client'

import {useEffect, useMemo, useState} from "react";
import {getDisabledMessages, pausedAmong} from "../query/circuit";

export interface UsePausedMessagesResult {
    /** The given type URLs that the chain currently refuses. */
    paused: string[];
    isPaused: boolean;
}

const REFRESH_MS = 60_000;

/**
 * Which of `typeUrls` are on the x/circuit disable list. Nothing is paused while loading and when
 * the query fails (fail open). Reloads on mount and every 60 s while mounted.
 */
export function usePausedMessages(typeUrls: string[]): UsePausedMessagesResult {
    const [disabled, setDisabled] = useState<string[]>([]);
    // Callers pass a fresh array every render: key on the contents.
    const key = typeUrls.join("\n");

    useEffect(() => {
        let cancelled = false;
        const load = () => getDisabledMessages().then(list => {
            if (!cancelled) setDisabled(list);
        });
        load();
        const timer = setInterval(load, REFRESH_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, []);

    const paused = useMemo(() => pausedAmong(disabled, key ? key.split("\n") : []), [disabled, key]);

    return {paused, isPaused: paused.length > 0};
}
