'use client';

import {useMemo} from "react";
import BigNumber from "bignumber.js";
import {uAmountToBigNumberAmount, useAsset, useAssetPrice} from "@bze/bze-ui-kit";

import {useBurningHistory} from "@/hooks/useBurningHistory";
import {useNextBurning} from "@/hooks/useNextBurning";
import {burnedTotal, burnShare} from "@/lib/token-site/burn";

/** One past burn of T, display units; `usd` at today's price, absent when T has no price. */
export interface TokenBurn {
    amount: BigNumber;
    usd?: BigNumber;
    blockHeight: string;
    timestamp: string;
}

export interface TokenBurnData {
    isLoading: boolean;
    /** Everything burned so far, display units. */
    burned: BigNumber;
    burnedUsd?: BigNumber;
    /** burned ÷ (supply + burned), 0…1. */
    share: BigNumber;
    /** Newest first. */
    history: TokenBurn[];
    /** T queued in the burner for the next burn; absent when none is queued. */
    next?: { amount: BigNumber; date: Date };
    /** The next burn's date whatever it holds, for "Queued for the next burn, in …". */
    nextDate?: Date;
    /** Reads the burner's queue again (after a burn). */
    reloadNext: () => Promise<void>;
}

/**
 * T's burn numbers (Business Logic R10): the total summed client-side over the burner history
 * (there is no per-denom endpoint), its share of the original supply, the history itself and
 * what the burner holds of T for the next burn. USD uses T's current price; none without one.
 */
export function useTokenBurn(denom: string): TokenBurnData {
    const {asset} = useAsset(denom);
    const {price, hasPrice} = useAssetPrice(denom);
    const {burnHistory, isLoading} = useBurningHistory(denom);
    const {nextBurn, reload} = useNextBurning();

    const totals = useMemo(() => {
        const burned = burnedTotal(burnHistory);
        const supply = asset ? uAmountToBigNumberAmount(asset.supply.toString(), asset.decimals) : new BigNumber(0);
        const usd = (amount: BigNumber) => (hasPrice ? amount.multipliedBy(price) : undefined);

        return {
            burned,
            burnedUsd: usd(burned),
            share: burnShare(burned, supply),
            history: burnHistory.map((burn) => ({
                amount: burn.amount,
                usd: usd(burn.amount),
                blockHeight: burn.blockHeight,
                timestamp: burn.timestamp,
            })),
        };
    }, [burnHistory, asset, hasPrice, price]);

    const next = useMemo(() => {
        const coin = nextBurn?.coins.find((c) => c.denom === denom);
        if (!nextBurn || !coin || !asset) return undefined;

        const amount = uAmountToBigNumberAmount(coin.amount, asset.decimals);
        return amount.gt(0) ? {amount, date: nextBurn.date} : undefined;
    }, [nextBurn, denom, asset]);

    return {isLoading, ...totals, next, nextDate: nextBurn?.date, reloadNext: reload};
}
