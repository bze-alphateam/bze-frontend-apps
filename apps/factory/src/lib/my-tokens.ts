import type { Asset } from "@bze/bze-ui-kit";

// Pure "my tokens" logic, extracted from useMyTokens so it can be unit-tested
// without React / chain queries. No next/* imports.

export interface MyToken {
    asset: Asset;
    /**
     * Current tokenfactory admin: an address, '' when renounced, or undefined
     * when the lookup failed (never show a trust badge for undefined).
     */
    admin: string | undefined;
}

/**
 * The connected address's own factory tokens: assets whose denom carries the
 * `factory/{address}/` prefix. Returns a new array; an empty/absent address
 * yields nothing (nothing is owned by "no address").
 */
export function filterMyTokens(
    assets: readonly Asset[],
    address: string | undefined,
): Asset[] {
    if (!address) return [];
    const prefix = `factory/${address}/`;
    return assets.filter((asset) => asset.denom.startsWith(prefix));
}

/** Per-denom admin lookups; undefined = the query for that denom failed. */
export type AdminMap = Record<string, string | undefined>;

/**
 * Pair each owned asset with its tokenfactory admin address, looked up in a
 * per-denom admin map. A missing entry (or a missing map) stays undefined —
 * unknown, never mistaken for a renounced admin.
 */
export function toMyTokens(
    assets: readonly Asset[],
    admins: AdminMap | undefined,
): MyToken[] {
    return assets.map((asset) => ({ asset, admin: admins?.[asset.denom] }));
}
