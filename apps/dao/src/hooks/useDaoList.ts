import {useCallback, useEffect, useRef, useState} from 'react';
import {loadDaoPage, PAGE_SIZE, type DaoDeps, type DaoFilter, type DaoListResult} from '@/lib/dao-loader';
import type {DaoCard} from '@/lib/dao-types';
import {searchTerm} from '@/lib/home-query';
import {pageCount} from '@/lib/pagination';
import {useAsync} from './useAsync';

type Ok = Extract<DaoListResult, {state: 'ok'}>;

/** The cursors of the pages visited in a list read by cursor; the first is null. */
interface Trail {
    scope: string;
    cursors: (string | null)[];
}

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
 * The All DAOs list for a filter and a page. Numbered while Scan answers totals (the page comes
 * from the caller, i.e. the URL); otherwise read by cursor with a trail of the pages visited, kept
 * per filter. What the pager needs (total, mode) is kept from the last answer of the same filter,
 * so a page change keeps the pager while the rows load.
 */
export function useDaoList(deps: DaoDeps, filter: DaoFilter, page: number): DaoListView {
    const [retries, setRetries] = useState(0);
    const scope = `${filter.kind}|${searchTerm(filter.search)}|${retries}`;

    const [trail, setTrail] = useState<Trail>({scope: '', cursors: [null]});
    const cursors = trail.scope === scope ? trail.cursors : [null];
    const cursor = cursors[cursors.length - 1];

    const [kept, setKept] = useState<{scope: string; result: Ok} | null>(null);
    const last = kept?.scope === scope ? kept.result : null;

    const key = `${scope}|${page}|${cursor ?? ''}`;
    // An answer for a key that is no longer the current one is dropped by useAsync, and must not become what the pager remembers either.
    const currentKey = useRef(key);
    useEffect(() => {
        currentKey.current = key;
    });

    const current = useAsync<DaoListResult>(key, async () => {
        // Once the list has answered in this scope it stays on its source (the chain's pages never go back to Scan, even on page 1); Retry starts a new scope.
        const result = await loadDaoPage(deps, filter, {page, cursor, source: last?.source});
        if (result.state === 'ok' && currentKey.current === key) setKept({scope, result});
        return result;
    });

    const ok = current.data?.state === 'ok' ? current.data : null;
    const shown = ok ?? last;
    const mode = shown?.mode ?? null;
    const total = mode === 'pages' ? shown?.total ?? null : null;
    const pages = total === null ? null : pageCount(total, PAGE_SIZE);

    const goNext = () => {
        if (ok?.next) setTrail({scope, cursors: [...cursors, ok.next]});
    };
    const goPrev = () => {
        if (cursors.length > 1) setTrail({scope, cursors: cursors.slice(0, -1)});
    };
    const retry = useCallback(() => setRetries((n) => n + 1), []);

    return {
        items: ok?.items ?? [],
        loading: current.loading,
        error: current.error,
        unsupported: current.data?.state === 'unsupported',
        source: shown?.source ?? null,
        mode,
        total,
        pages,
        page: mode === 'cursor' ? cursors.length : page,
        hasPrev: cursors.length > 1,
        hasNext: ok?.next != null,
        pastEnd: ok && ok.mode === 'pages' && ok.returned === 0 && ok.total !== null && ok.total > 0 && page > 1 ? pageCount(ok.total, PAGE_SIZE) : null,
        goPrev,
        goNext,
        retry,
    };
}
