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
    const query = parseHomeQuery(params?.toString() ?? '', wallet);

    const hrefOf = useCallback((next: HomeQuery) => `${pathname}${buildHomeQuery(next, wallet)}`, [pathname, wallet]);

    const pushPage = useCallback((page: number) => router.push(hrefOf({...query, page}), {scroll: false}), [router, hrefOf, query]);
    const replacePage = useCallback((page: number) => router.replace(hrefOf({...query, page}), {scroll: false}), [router, hrefOf, query]);
    const setFilters = useCallback(
        (change: Partial<Pick<HomeQuery, 'kind' | 'q' | 'mine'>>) => router.replace(hrefOf({...query, ...change, page: 1}), {scroll: false}),
        [router, hrefOf, query],
    );

    return {query, pushPage, replacePage, setFilters};
}
