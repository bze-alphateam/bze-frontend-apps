import {useCallback} from 'react';
import {useRouter, useSearchParams} from 'next/navigation';
import {historyHref, parseHistoryPage, parseProposalsQuery, proposalsHref, type ProposalsQuery} from '@/lib/dao-tab-query';
import type {ProposalFilter} from '@/lib/proposal-list';

export interface ProposalsUrl {
    query: ProposalsQuery;
    /** Another page: a new history entry, so Back returns to the page before. */
    pushPage: (page: number) => void;
    /** Another page without a history entry (a page past the end goes to the last one). */
    replacePage: (page: number) => void;
    /** Another status: replaces the entry and starts again at page 1. */
    setFilter: (filter: ProposalFilter) => void;
}

/** The Proposals tab's status and page in the URL, next to `tab=proposals`. Needs a Suspense boundary above it. */
export function useProposalsUrl(daoId: string): ProposalsUrl {
    const router = useRouter();
    const search = useSearchParams()?.toString() ?? '';
    const query = parseProposalsQuery(search);

    // keyed on the query string, so the callbacks only change when the URL does
    const go = useCallback(
        (how: 'push' | 'replace', change: Partial<ProposalsQuery>) => {
            router[how](proposalsHref(daoId, {...parseProposalsQuery(search), ...change}), {scroll: false});
        },
        [router, daoId, search],
    );

    const pushPage = useCallback((page: number) => go('push', {page}), [go]);
    const replacePage = useCallback((page: number) => go('replace', {page}), [go]);
    const setFilter = useCallback((filter: ProposalFilter) => go('replace', {filter, page: 1}), [go]);
    return {query, pushPage, replacePage, setFilter};
}

export interface HistoryUrl {
    page: number;
    pushPage: (page: number) => void;
    replacePage: (page: number) => void;
}

/** The History tab's page in the URL, next to `tab=history`. */
export function useHistoryUrl(daoId: string): HistoryUrl {
    const router = useRouter();
    const search = useSearchParams()?.toString() ?? '';
    const page = parseHistoryPage(search);
    const pushPage = useCallback((n: number) => router.push(historyHref(daoId, n), {scroll: false}), [router, daoId]);
    const replacePage = useCallback((n: number) => router.replace(historyHref(daoId, n), {scroll: false}), [router, daoId]);
    return {page, pushPage, replacePage};
}
