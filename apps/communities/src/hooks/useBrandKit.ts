'use client';

import {useEffect, useState} from "react";
import {DenomBranding, getDenomBranding} from "@bze/bze-ui-kit";

import {createBrandKitCache} from "@/lib/brand-kit";

const brandKits = createBrandKitCache(getDenomBranding);

interface BrandKitState {
    denom: string;
    kit: DenomBranding | null;
}

/**
 * The on-chain brand kit of `denom` (chain v8.2.0), cached for a few minutes. `undefined` until
 * it is known, `null` when the token has none or the query failed (default theme either way).
 * Never returns the kit of a previous denom, so two kits can't flicker on navigation.
 */
export function useBrandKit(denom: string | undefined): DenomBranding | null | undefined {
    const [state, setState] = useState<BrandKitState | undefined>(undefined);

    useEffect(() => {
        if (!denom) return;
        let cancelled = false;

        brandKits.get(denom).then(kit => {
            if (!cancelled) setState({denom, kit});
        });

        return () => { cancelled = true; };
    }, [denom]);

    if (!denom) return undefined;
    if (state?.denom === denom) return state.kit;

    return brandKits.peek(denom);
}
