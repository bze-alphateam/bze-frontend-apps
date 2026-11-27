import {useCallback} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {buildHomeQuery, parseHomeQuery, type HomeQuery} from '@/lib/home-query';

export interface HomeUrl {
    query: HomeQuery;
    /** Another page: a new history entry, so Back returns to the page before. */
    pushPage: (page: number) => void;
    /** Another page without a history entry (a page past the end goes to the last one). */
    replacePage: (page: number) => void;
    /** A filter changed: replaces the entry and starts again at page 1. */
    setFilters: (change: Partial<Pick<HomeQuery, 'kind' | 'q' | 'mine'>>) => void;
}

/**
 * The home page's view in the URL (`?page`, `?type`, `?q`, `?mine`). Needs a Suspense boundary
 * above it. `mine` only counts with a wallet connected.
 */
export function useHomeUrl(wallet: boolean): HomeUrl {
    const params = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const search = params?.toString() ?? '';
    const query = parseHomeQuery(search, wallet);

    // keyed on the query string, not on the parsed object, so the callbacks only change when the URL does
    const go = useCallback(
        (how: 'push' | 'replace', change: Partial<HomeQuery>) => {
            const next = {...parseHomeQuery(search, wallet), ...change};
            router[how](`${pathname}${buildHomeQuery(next, wallet)}`, {scroll: false});
        },
        [router, pathname, search, wallet],
    );

    const pushPage = useCallback((page: number) => go('push', {page}), [go]);
    const replacePage = useCallback((page: number) => go('replace', {page}), [go]);
    const setFilters = useCallback((change: Partial<Pick<HomeQuery, 'kind' | 'q' | 'mine'>>) => go('replace', {...change, page: 1}), [go]);

    return {query, pushPage, replacePage, setFilters};
}
