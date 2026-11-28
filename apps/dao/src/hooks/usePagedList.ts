import {useCallback, useEffect, useRef, useState} from 'react';
import {pastEndPage, type PagedPage, type PagePosition, type PageMode} from '@/lib/paged-list';
import {pageCount} from '@/lib/pagination';
import {useAsync} from './useAsync';

/** The cursors of the pages visited in a list read by cursor; the first is null. */
interface Trail {
    scope: string;
    cursors: (string | null)[];
}

export interface PagedListView<P extends PagedPage<unknown, string>, R extends {state: string}> {
    /** The current answer, whatever its state; undefined while it loads or after an error. */
    result: P | R | undefined;
    /** The current answer when it is a page. */
    current: P | null;
    /** The page shown: the current one, else the last of the same scope (kept while the next loads). */
    shown: P | null;
    /** The last page answered in any scope (a filter change keeps it): for what a filter does not change, such as counts. */
    latest: P | null;
    items: P['items'];
    loading: boolean;
    error: unknown;
    /** Where the list came from; known once a page has answered (and kept while the next loads). */
    source: P['source'] | null;
    /** `pages`: numbered with a total. `cursor`: Prev / Next only. null until a page has answered. */
    mode: PageMode | null;
    total: number | null;
    /** Number of pages in `pages` mode. */
    pages: number | null;
    /** The page shown: the caller's in `pages` mode, the position in the trail in `cursor` mode. */
    page: number;
    hasPrev: boolean;
    hasNext: boolean;
    /** The list is numbered and the page asked is past its end: the last page to go to. */
    pastEnd: number | null;
    goPrev: () => void;
    goNext: () => void;
    /** Reads the list again from its first source (a new scope). */
    retry: () => void;
}

const isPage = <P extends PagedPage<unknown, string>>(value: unknown): value is P =>
    typeof value === 'object' && value !== null && (value as {state?: unknown}).state === 'ok';

/**
 * A paged list for a scope (what is listed: a DAO and its filter) and a page. Numbered while the
 * loader answers totals (the page comes from the caller, i.e. the URL); otherwise read by cursor with
 * a trail of the pages visited, kept per scope. What the pager needs (total, mode, source) is kept
 * from the last answer of the same scope, so a page change keeps the pager while the rows load, and a
 * late answer of an older page never becomes what the pager remembers. Once a scope has answered, its
 * later pages stay on that answer's source (`position.source`); Retry starts a new scope.
 *
 * `load` answers a page (`state: 'ok'`, see `PagedPage`, with any extra fields) or another state of
 * its own (`R`, e.g. "unsupported"), or throws.
 */
export function usePagedList<P extends PagedPage<unknown, string>, R extends {state: string} = never>(
    scope: string,
    page: number,
    pageSize: number,
    load: (position: PagePosition<P['source']>) => Promise<P | R>,
): PagedListView<P, R> {
    const [retries, setRetries] = useState(0);
    const scopeKey = `${scope}|${retries}`;

    const [trail, setTrail] = useState<Trail>({scope: '', cursors: [null]});
    const cursors = trail.scope === scopeKey ? trail.cursors : [null];
    const cursor = cursors[cursors.length - 1];

    const [kept, setKept] = useState<{scope: string; result: P} | null>(null);
    const last = kept?.scope === scopeKey ? kept.result : null;

    const key = `${scopeKey}|${page}|${cursor ?? ''}`;
    // An answer for a key that is no longer the current one is dropped by useAsync, and must not become what the pager remembers either.
    const currentKey = useRef(key);
    useEffect(() => {
        currentKey.current = key;
    });

    const answer = useAsync<P | R>(key, async () => {
        const result = await load({page, cursor, source: last?.source});
        if (isPage<P>(result) && currentKey.current === key) setKept({scope: scopeKey, result});
        return result;
    });

    const current = isPage<P>(answer.data) ? answer.data : null;
    const shown = current ?? last;
    const mode = shown?.mode ?? null;
    const total = mode === 'pages' ? shown?.total ?? null : null;
    const pages = total === null ? null : pageCount(total, pageSize);

    const goNext = () => {
        if (current?.next) setTrail({scope: scopeKey, cursors: [...cursors, current.next]});
    };
    const goPrev = () => {
        if (cursors.length > 1) setTrail({scope: scopeKey, cursors: cursors.slice(0, -1)});
    };
    const retry = useCallback(() => setRetries((n) => n + 1), []);

    return {
        result: answer.data,
        current,
        shown,
        latest: current ?? kept?.result ?? null,
        items: (current?.items ?? []) as P['items'],
        loading: answer.loading,
        error: answer.error,
        source: shown?.source ?? null,
        mode,
        total,
        pages,
        page: mode === 'cursor' ? cursors.length : page,
        hasPrev: cursors.length > 1,
        hasNext: current?.next != null,
        pastEnd: pastEndPage(current, page, pageSize),
        goPrev,
        goNext,
        retry,
    };
}
