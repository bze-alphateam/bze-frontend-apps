import {pageCount} from './pagination';

// Paging against BZE Scan, shared by every numbered list of the app (the home page's DAOs, a DAO's
// proposals and history, a proposal's votes). A Scan with numbered pages answers `page` with a
// `total` (and a null `next_cursor`); an older Scan ignores `page` and answers its first cursor page
// without a total. So an answer without a total switches the list to cursor mode (Prev / Next over
// `next_cursor`); it never means "this is page N". Never `page` together with `cursor`: Scan answers 400.

/** `pages`: numbered, the total known. `cursor`: only the page after this one (an older Scan, the chain). */
export type PageMode = 'pages' | 'cursor';

/** Where a page is read from: a numbered page, or the cursor / key after the page before it. */
export interface PagePosition<S extends string = string> {
    /** 1-based; used while Scan answers numbered pages. */
    page: number;
    /** The cursor (Scan) or key (chain) of the page after the one before; null for the first. */
    cursor?: string | null;
    /** Where the list started, once it has: a later page never switches source. */
    source?: S;
}

/** One page of a list as `usePagedList` reads it. A loader may add fields of its own (counts). */
export interface PagedPage<T, S extends string = string> {
    state: 'ok';
    items: T[];
    /** How many rows the source returned before any filtering here: 0 on a page past the end. */
    returned: number;
    /** Where the page came from. */
    source: S;
    mode: PageMode;
    /** The rows across every page; set in `pages` mode only. */
    total: number | null;
    /** Pass back as the cursor to read the page after this one; null on the last, and always in `pages` mode. */
    next: string | null;
}

/** What a Scan list answer needs for paging. */
export interface ScanPagedAnswer {
    /** Missing or null: an answer without a total (an older Scan, or a cursor request). */
    total?: number | null;
    next_cursor: string | null;
}

/** Where `readScanPage` asks Scan to read from: a page number, or a cursor (null: the first page). */
export type ScanPageAt = {page: number} | {cursor: string | null};

/**
 * The Scan clients that answered a `page` request without a total (a Scan before numbered pages):
 * their lists are read by cursor from then on, without asking again. One memory per kind of list,
 * keyed per client, so a test's fresh client starts numbered.
 */
export interface PagingMemory {
    numbered(client: object): boolean;
    withoutTotals(client: object): void;
}

export function createPagingMemory(): PagingMemory {
    const without = new WeakSet<object>();
    return {
        numbered: (client) => !without.has(client),
        withoutTotals: (client) => {
            without.add(client);
        },
    };
}

/**
 * Reads one page of a Scan list: by page number while `client` answers totals, else by cursor. An
 * answer to a `page` request without a total is Scan's first cursor page: the client is remembered as
 * one without totals and the answer is read as cursor mode. In `pages` mode `next_cursor` is never read.
 */
export async function readScanPage<A extends ScanPagedAnswer>(
    memory: PagingMemory,
    client: object,
    position: Pick<PagePosition, 'page' | 'cursor'>,
    read: (at: ScanPageAt) => Promise<A>,
): Promise<{answer: A; mode: PageMode; total: number | null; next: string | null}> {
    const numbered = memory.numbered(client);
    const answer = await read(numbered ? {page: position.page} : {cursor: position.cursor ?? null});
    const total = answer.total ?? null;
    if (numbered && total !== null) return {answer, mode: 'pages', total, next: null};
    if (numbered) memory.withoutTotals(client);
    return {answer, mode: 'cursor', total: null, next: answer.next_cursor};
}

/** A numbered list asked for a page past its end (no rows, but a total): the last page to go to; else null. */
export function pastEndPage(result: Pick<PagedPage<unknown>, 'mode' | 'returned' | 'total'> | null, page: number, pageSize: number): number | null {
    if (!result || result.mode !== 'pages' || result.returned !== 0 || result.total === null || result.total <= 0 || page <= 1) return null;
    return pageCount(result.total, pageSize);
}
