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
