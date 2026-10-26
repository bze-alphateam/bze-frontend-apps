'use client'

import {useCallback, useEffect, useMemo, useState} from "react";
import {getHaltedDenoms} from "../query/halted_denoms";
import {useAssetsContext} from "./useAssets";
import {DenomPair, isDenomHaltedIn, isPairHaltedIn} from "../utils/halted_denoms";

export interface UseHaltedDenomsResult {
    haltedDenoms: Set<string>;
    isDenomHalted: (denom: string | undefined) => boolean;
    /** A market object, or a market id resolved through the assets context's markets map. */
    isMarketHalted: (market: DenomPair | string | undefined) => boolean;
    /** A pool object, or a pool id resolved through the assets context's pools map. */
    isPoolHalted: (pool: DenomPair | string | undefined) => boolean;
    isLoading: boolean;
}

/**
 * Denoms halted on the chain (tradebin `HaltedDenoms`). Empty while loading and when the query
 * fails (fail open — the chain enforces the halt anyway).
 */
export function useHaltedDenoms(): UseHaltedDenomsResult {
    const {marketsMap, poolsMap} = useAssetsContext();
    const [denoms, setDenoms] = useState<string[] | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        getHaltedDenoms().then(list => {
            if (!cancelled) setDenoms(list);
        });
        return () => { cancelled = true; };
    }, []);

    const haltedDenoms = useMemo(() => new Set(denoms ?? []), [denoms]);

    const isDenomHalted = useCallback((denom: string | undefined) => isDenomHaltedIn(haltedDenoms, denom), [haltedDenoms]);

    const isMarketHalted = useCallback((market: DenomPair | string | undefined) => {
        const pair = typeof market === "string" ? marketsMap.get(market) : market;
        return isPairHaltedIn(haltedDenoms, pair);
    }, [haltedDenoms, marketsMap]);

    const isPoolHalted = useCallback((pool: DenomPair | string | undefined) => {
        const pair = typeof pool === "string" ? poolsMap.get(pool) : pool;
        return isPairHaltedIn(haltedDenoms, pair);
    }, [haltedDenoms, poolsMap]);

    return {
        haltedDenoms,
        isDenomHalted,
        isMarketHalted,
        isPoolHalted,
        isLoading: denoms === undefined,
    };
}
