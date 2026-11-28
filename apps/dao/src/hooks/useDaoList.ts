import {loadDaoPage, PAGE_SIZE, type DaoDeps, type DaoFilter, type DaoListResult} from '@/lib/dao-loader';
import type {DaoCard} from '@/lib/dao-types';
import {searchTerm} from '@/lib/home-query';
import {usePagedList} from './usePagedList';

type Ok = Extract<DaoListResult, {state: 'ok'}>;
type Other = Exclude<DaoListResult, {state: 'ok'}>;

export interface DaoListView {
    items: DaoCard[];
    loading: boolean;
    error: unknown;
    /** The node runs v8.2.x: there is no list. */
    unsupported: boolean;
    /** Where the list came from; known once a page has answered (and kept while the next loads). */
    source: 'scan' | 'chain' | null;
    /** `pages`: numbered with a total. `cursor`: Prev / Next only. null until a page has answered. */
    mode: 'pages' | 'cursor' | null;
    total: number | null;
    /** Number of pages in `pages` mode. */
    pages: number | null;
    /** The page shown: the URL's in `pages` mode, the position in the trail in `cursor` mode. */
    page: number;
    hasPrev: boolean;
    hasNext: boolean;
    /** The list is numbered and the page asked is past its end: the last page to go to. */
    pastEnd: number | null;
    goPrev: () => void;
    goNext: () => void;
    /** Reads the list again, from Scan first. */
    retry: () => void;
}

/**
 * The All DAOs list for a filter and a page, through the shared `usePagedList`: numbered while Scan
 * answers totals (the page comes from the caller, i.e. the URL); otherwise read by cursor with a trail
 * of the pages visited, kept per filter.
 */
export function useDaoList(deps: DaoDeps, filter: DaoFilter, page: number): DaoListView {
    const scope = `${filter.kind}|${searchTerm(filter.search)}`;
    const list = usePagedList<Ok, Other>(scope, page, PAGE_SIZE, (position) => loadDaoPage(deps, filter, position));

    return {
        items: list.items,
        loading: list.loading,
        error: list.error,
        unsupported: list.result?.state === 'unsupported',
        source: list.source,
        mode: list.mode,
        total: list.total,
        pages: list.pages,
        page: list.page,
        hasPrev: list.hasPrev,
        hasNext: list.hasNext,
        pastEnd: list.pastEnd,
        goPrev: list.goPrev,
        goNext: list.goNext,
        retry: list.retry,
    };
}
