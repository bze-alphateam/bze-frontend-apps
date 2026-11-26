import {useEffect, useRef, useState} from 'react';

export interface AsyncValue<T> {
    data: T | undefined;
    error: unknown;
    /** True until the loader of the current key has answered. */
    loading: boolean;
}

/**
 * Runs `loader` when `key` changes (a null key runs nothing) and keeps its answer. A newer key
 * discards a late answer of the older one, and the value of an older key is never shown for the
 * new one: `loading` is derived from the key, so no state is set inside the effect's own turn.
 */
export function useAsync<T>(key: string | null, loader: () => Promise<T>): AsyncValue<T> {
    const [result, setResult] = useState<{key: string; data?: T; error?: unknown} | null>(null);
    const loaderRef = useRef(loader);
    useEffect(() => {
        loaderRef.current = loader;
    });

    useEffect(() => {
        if (key === null) return;
        let current = true;
        loaderRef.current().then(
            (data) => current && setResult({key, data}),
            (error) => current && setResult({key, error}),
        );
        return () => {
            current = false;
        };
    }, [key]);

    const answered = result !== null && result.key === key;
    return {
        data: answered ? result.data : undefined,
        error: answered ? result.error : undefined,
        loading: key !== null && !answered,
    };
}
