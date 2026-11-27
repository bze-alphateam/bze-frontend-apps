import type {DaoKind} from './dao-types';

/** The home page's view as the URL carries it. */
export interface HomeQuery {
    /** 1-based page; 1 when the URL has none or an unusable one. */
    page: number;
    kind: DaoKind | '';
    /** The name search as typed (after the debounce). */
    q: string;
    /** My DAOs on; only ever true with a wallet connected. */
    mine: boolean;
}

/** Scan refuses a page above this (its offset must not overflow). */
const MAX_PAGE = 2 ** 31;

const KINDS: DaoKind[] = ['static_list', 'stake'];

/** Scan's `q` needs two characters; a shorter term is neither sent nor applied. */
export const SEARCH_MIN_LENGTH = 2;

/** The name search that is really applied: trimmed, and empty while it is too short. */
export const searchTerm = (q: string): string => {
    const term = q.trim();
    return term.length >= SEARCH_MIN_LENGTH ? term : '';
};

/**
 * Reads the home page's URL query. Invalid values are ignored (a page that is not a positive
 * integer is 1, an unknown type is All) and `mine` only counts with a wallet connected.
 */
export function parseHomeQuery(search: string | URLSearchParams, wallet: boolean): HomeQuery {
    const params = typeof search === 'string' ? new URLSearchParams(search) : search;

    const rawPage = params.get('page') ?? '';
    const page = /^[1-9]\d*$/.test(rawPage) && Number(rawPage) <= MAX_PAGE ? Number(rawPage) : 1;
    const rawKind = params.get('type') ?? '';
    const kind = (KINDS as string[]).includes(rawKind) ? (rawKind as DaoKind) : '';

    return {page, kind, q: params.get('q') ?? '', mine: wallet && params.get('mine') === '1'};
}

/**
 * The query string of a view ("" or "?type=stake&page=2"): page 1, All, an empty search and
 * My DAOs without a wallet are left out.
 */
export function buildHomeQuery(query: HomeQuery, wallet: boolean): string {
    const params = new URLSearchParams();
    if (query.mine && wallet) params.set('mine', '1');
    if (query.kind) params.set('type', query.kind);
    if (query.q.trim()) params.set('q', query.q.trim());
    if (query.page > 1) params.set('page', String(query.page));
    const text = params.toString();
    return text ? `?${text}` : '';
}
