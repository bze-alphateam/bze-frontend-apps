'use client';

import {DEFAULT_DENOM_BRANDING, type DenomBranding} from "@bze/bze-ui-kit";

import {useBrandKit} from "@/hooks/useBrandKit";

/**
 * The brand kit the token site is drawn with (Business Logic R1): the token's own kit, or
 * `DEFAULT_DENOM_BRANDING` when it has none or the query failed. `undefined` only while the
 * first answer for `denom` is pending.
 */
export function useTokenBrandKit(denom: string | undefined): DenomBranding | undefined {
    const kit = useBrandKit(denom);
    if (!denom) return DEFAULT_DENOM_BRANDING;
    if (kit === undefined) return undefined;

    return kit ?? DEFAULT_DENOM_BRANDING;
}
