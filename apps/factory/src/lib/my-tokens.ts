import type { Asset } from "@bze/bze-ui-kit";

// Pure "my tokens" logic, extracted from useMyTokens so it can be unit-tested
// without React / chain queries. No next/* imports.

export interface MyToken {
    asset: Asset;
    /** Current tokenfactory admin — empty string means the admin was renounced. */
    admin: string;
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

/**
 * Pair each owned asset with its tokenfactory admin address, looked up in a
 * per-denom admin map. A missing entry defaults to '' — a renounced or
 * not-yet-loaded admin.
 */
export function toMyTokens(
    assets: readonly Asset[],
    admins: Record<string, string> | undefined,
): MyToken[] {
    return assets.map((asset) => ({ asset, admin: admins?.[asset.denom] ?? "" }));
}
