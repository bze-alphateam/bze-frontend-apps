'use client';

import {useEffect, useMemo, useState} from "react";
import BigNumber from "bignumber.js";
import {
    getDenomReward,
    getStakingRewards,
    uAmountToBigNumberAmount,
    useAsset,
    useAssetLiquidityPools,
    useAssetPrice,
} from "@bze/bze-ui-kit";

import {useBurningHistory} from "@/hooks/useBurningHistory";
import {isActiveStakingReward} from "@/lib/directory-facts";

/** The token page's key numbers in display units (USD for cap and volume); absent = hidden. */
export interface KeyNumbers {
    marketCap?: BigNumber;
    supply?: BigNumber;
    staked?: BigNumber;
    burned?: BigNumber;
    volume24h?: BigNumber;
}

interface StakedState {
    denom: string;
    /** Base units; undefined when the holders pool could not be read. */
    amount?: BigNumber;
}

/**
 * Staked T in base units: the holders pool's `staked_amount` plus every active fixed-term
 * program staking T. Undefined while loading or when the holders pool query failed (a missing
 * pool counts as 0; reward programs fail open to an empty list in ui-kit).
 */
function useStakedAmount(denom: string): BigNumber | undefined {
    const [state, setState] = useState<StakedState | undefined>(undefined);

    useEffect(() => {
        if (!denom) return;
        let cancelled = false;

        Promise.all([getDenomReward(denom), getStakingRewards()])
            .then(([denomReward, programs]) => {
                const fromPrograms = programs.list
                    .filter((program) => program.staking_denom === denom && isActiveStakingReward(program))
                    .reduce((sum, program) => sum.plus(program.staked_amount || 0), new BigNumber(0));
                const amount = fromPrograms.plus(denomReward?.staked_amount || 0);
                if (!cancelled) setState({denom, amount});
            })
            .catch((e) => {
                console.error("failed to load the staked amount of", denom, e);
                if (!cancelled) setState({denom});
            });

        return () => { cancelled = true; };
    }, [denom]);

    return state?.denom === denom ? state.amount : undefined;
}

/** Business Logic R3: market cap, supply, staked, burned and 24h volume, each when computable. */
export function useKeyNumbers(denom: string): KeyNumbers {
    const {asset} = useAsset(denom);
    const {price, hasPrice} = useAssetPrice(denom);
    const {assetPools, assetPoolsData} = useAssetLiquidityPools(denom);
    const {burnHistory, isLoading: burnsLoading} = useBurningHistory(denom);
    const stakedBase = useStakedAmount(denom);

    return useMemo(() => {
        const numbers: KeyNumbers = {};
        if (!asset) return numbers;

        const supply = uAmountToBigNumberAmount(asset.supply.toString(), asset.decimals);
        numbers.supply = supply;
        if (hasPrice) numbers.marketCap = supply.multipliedBy(price);
        if (stakedBase) numbers.staked = uAmountToBigNumberAmount(stakedBase, asset.decimals);
        if (!burnsLoading) {
            numbers.burned = burnHistory.reduce((sum, burn) => sum.plus(burn.amount), new BigNumber(0));
        }
        if (assetPools.length > 0) {
            numbers.volume24h = Array.from(assetPoolsData.values())
                .reduce((sum, pool) => sum.plus(pool.usdVolume), new BigNumber(0));
        }

        return numbers;
    }, [asset, hasPrice, price, stakedBase, burnsLoading, burnHistory, assetPools, assetPoolsData]);
}
