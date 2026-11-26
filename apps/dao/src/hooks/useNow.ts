import {useEffect, useState} from 'react';

/** The current time in ms, refreshed every `everyMs`: relative times on a page stay honest without a reload. */
export function useNow(everyMs = 30_000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), everyMs);
        return () => clearInterval(timer);
    }, [everyMs]);
    return now;
}
