import { Asset, isFactoryDenom } from "@bze/bze-ui-kit";

// Token directory: pure logic shared by the directory page and its tests.
// Kept free of React and next/* imports so it can be unit-tested in isolation.

// Tokens shown per page in the client-side paginated directory.
export const PAGE_SIZE = 20;

// Query-string key carrying the (URL-encoded) denom on the token page.
export const DENOM_PARAM = "denom";

/**
 * Canonical token page URL. The denom is always URL-encoded in the query
 * string, never in the path (factory denoms contain `/`). See Business Logic §3.
 */
export const tokenPagePath = (denom: string): string =>
    `/token?${DENOM_PARAM}=${encodeURIComponent(denom)}`;

/**
 * Every factory token, alphabetical by ticker. Non-factory denoms are dropped
 * (excluded assets are already removed upstream in getChainAssets — Business
 * Logic §1). Returns a new array; the input is not mutated.
 */
export function filterAndSortFactoryTokens(assets: Asset[]): Asset[] {
    return assets
        .filter((asset) => isFactoryDenom(asset.denom))
        .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

/** Number of pages needed for `tokenCount` tokens — never less than 1. */
export function getTotalPages(tokenCount: number, pageSize: number = PAGE_SIZE): number {
    return Math.max(1, Math.ceil(tokenCount / pageSize));
}

/** Clamp a requested 1-based page into the valid `[1, totalPages]` range. */
export function clampPage(page: number, totalPages: number): number {
    return Math.min(Math.max(1, page), totalPages);
}

/** The slice of tokens visible on a given 1-based page. */
export function pageSlice<T>(tokens: T[], page: number, pageSize: number = PAGE_SIZE): T[] {
    const start = (page - 1) * pageSize;
    return tokens.slice(start, start + pageSize);
}

// ---------------------------------------------------------------------------------------------
// Search, filters, sort and URL state (Business Logic R14, BFE-126)
// ---------------------------------------------------------------------------------------------

export const DIRECTORY_FILTERS = ["all", "verified", "rewards", "tradable"] as const;
export type DirectoryFilter = typeof DIRECTORY_FILTERS[number];

export const DIRECTORY_SORTS = ["name", "cap", "vol"] as const;
export type DirectorySort = typeof DIRECTORY_SORTS[number];

/** Everything the directory keeps in the URL: `?q=&filter=&sort=&page=`. */
export interface DirectoryState {
    /** The search text as typed (matching trims it). */
    q: string;
    filter: DirectoryFilter;
    sort: DirectorySort;
    /** 1-based; only the lower bound is known here, the page clamps the upper one. */
    page: number;
}

export const DEFAULT_DIRECTORY_STATE: DirectoryState = {q: "", filter: "all", sort: "name", page: 1};

const oneOf = <T extends string>(values: readonly T[], value: string | null, fallback: T): T =>
    values.includes(value as T) ? value as T : fallback;

/** Reads the directory state from the URL; unknown values fall back to the defaults. */
export function parseDirectoryQuery(params: { get(name: string): string | null }): DirectoryState {
    const rawPage = params.get("page");
    const page = rawPage !== null && /^\d+$/.test(rawPage.trim()) ? Number(rawPage.trim()) : 1;

    return {
        q: params.get("q") ?? "",
        filter: oneOf(DIRECTORY_FILTERS, params.get("filter"), DEFAULT_DIRECTORY_STATE.filter),
        sort: oneOf(DIRECTORY_SORTS, params.get("sort"), DEFAULT_DIRECTORY_STATE.sort),
        page: Math.max(1, page),
    };
}

/** The query string for `state` (without `?`), defaults omitted; `""` for the default view. */
export function directoryQueryString(state: DirectoryState): string {
    const params = new URLSearchParams();
    if (state.q.trim() !== "") params.set("q", state.q);
    if (state.filter !== DEFAULT_DIRECTORY_STATE.filter) params.set("filter", state.filter);
    if (state.sort !== DEFAULT_DIRECTORY_STATE.sort) params.set("sort", state.sort);
    if (state.page > 1) params.set("page", String(state.page));

    return params.toString();
}

/** What the directory knows about each token beyond its `Asset`, keyed by denom. */
export interface DirectoryFacts {
    /** Denoms with a holders pool (denom reward, DR). */
    holdersPool: ReadonlySet<string>;
    /** Denoms staked in at least one active reward program (staking reward, SR). */
    rewardPrograms: ReadonlySet<string>;
    /** Denoms in at least one liquidity pool. */
    tradable: ReadonlySet<string>;
    /** Supply × USD price; absent or 0 when the token has no price. */
    marketCap: ReadonlyMap<string, number>;
    /** Σ 24h USD volume of the pools holding the denom. */
    volume: ReadonlyMap<string, number>;
}

const matchesSearch = (asset: Asset, needle: string): boolean =>
    needle === "" ||
    asset.name.toLowerCase().includes(needle) ||
    asset.ticker.toLowerCase().includes(needle) ||
    asset.denom.toLowerCase().includes(needle);

const matchesFilter = (asset: Asset, filter: DirectoryFilter, facts: DirectoryFacts): boolean => {
    switch (filter) {
        case "verified":
            return asset.verified;
        case "rewards":
            return facts.holdersPool.has(asset.denom) || facts.rewardPrograms.has(asset.denom);
        case "tradable":
            return facts.tradable.has(asset.denom);
        default:
            return true;
    }
};

const byTicker = (a: Asset, b: Asset) => a.ticker.localeCompare(b.ticker);

/** Descending by `value`; tokens whose value is missing or 0 go last; ties by ticker. */
const byValueDesc = (values: ReadonlyMap<string, number>) => (a: Asset, b: Asset): number => {
    const va = values.get(a.denom) ?? 0;
    const vb = values.get(b.denom) ?? 0;
    if (va !== vb) return vb - va;
    return byTicker(a, b);
};

/**
 * The tokens matching the search and filter of `state`, in its sort order. Search is a trimmed,
 * case-insensitive substring over name, ticker and full denom. Returns a new array.
 */
export function filterSortTokens(tokens: Asset[], state: DirectoryState, facts: DirectoryFacts): Asset[] {
    const needle = state.q.trim().toLowerCase();
    const result = tokens.filter((asset) => matchesSearch(asset, needle) && matchesFilter(asset, state.filter, facts));

    switch (state.sort) {
        case "cap":
            return result.sort(byValueDesc(facts.marketCap));
        case "vol":
            return result.sort(byValueDesc(facts.volume));
        default:
            return result.sort(byTicker);
    }
}

/** "Showing 21–40 of 53 tokens" (or "0 tokens") for a 1-based page of `total` matches. */
export function showingLine(total: number, page: number, pageSize: number = PAGE_SIZE): string {
    if (total === 0) return "0 tokens";
    const first = (page - 1) * pageSize + 1;
    const last = Math.min(total, page * pageSize);
    return `Showing ${first}–${last} of ${total} token${total === 1 ? "" : "s"}`;
}

/**
 * The numbered buttons of the pager: every page when there are few, otherwise the first, the
 * last and the neighbours of the current page, with `"gap"` where pages are skipped.
 */
export function paginationItems(page: number, totalPages: number): (number | "gap")[] {
    if (totalPages <= 7) {
        return Array.from({length: totalPages}, (_, i) => i + 1);
    }

    const shown = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
    // Near an edge, show enough pages that the row keeps the same width.
    if (page <= 3) [2, 3, 4].forEach((p) => shown.add(p));
    if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => shown.add(p));

    const sorted = [...shown].sort((a, b) => a - b);
    const items: (number | "gap")[] = [];
    sorted.forEach((p, i) => {
        if (i > 0 && p - sorted[i - 1] > 1) items.push("gap");
        items.push(p);
    });

    return items;
}
