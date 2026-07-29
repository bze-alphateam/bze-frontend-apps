import { Asset, isNativeDenom } from "@bze/bze-ui-kit";

// Pure list logic for the assets page, extracted so it can be unit-tested without
// React / next wiring. Free of next/* and React imports.

/**
 * Assets ordered for the directory: the native denom first, then verified tokens,
 * then everything else alphabetically by name. Returns a new array — the input,
 * which comes straight from a shared hook, is never sorted in place.
 */
export function sortAssetsForDirectory(assets: readonly Asset[]): Asset[] {
    return [...assets].sort((token1, token2) => {
        // Native denom should always be first.
        const token1IsNative = isNativeDenom(token1.denom);
        const token2IsNative = isNativeDenom(token2.denom);

        if (token1IsNative && !token2IsNative) {
            return -1;
        }
        if (!token1IsNative && token2IsNative) {
            return 1;
        }

        // Then verified tokens.
        if (token1.verified && !token2.verified) {
            return -1;
        }
        if (token2.verified && !token1.verified) {
            return 1;
        }

        // Finally alphabetically by name.
        return token1.name > token2.name ? 1 : -1;
    });
}

/**
 * Assets whose name or ticker contains the search term, case-insensitively.
 * An empty term matches every asset.
 */
export function filterAssetsBySearch(assets: readonly Asset[], searchTerm: string): Asset[] {
    const term = searchTerm.toLowerCase();
    return assets.filter(
        (asset) =>
            asset.name.toLowerCase().includes(term) ||
            asset.ticker.toLowerCase().includes(term),
    );
}
