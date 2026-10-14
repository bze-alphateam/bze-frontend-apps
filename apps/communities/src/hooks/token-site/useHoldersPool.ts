'use client';

import {useCallback, useEffect, useMemo, useState} from "react";
import BigNumber from "bignumber.js";
import {
    type DenomRewardHolderItem,
    type DenomRewardSchedule,
    getDenomRewardSchedules,
    uAmountToBigNumberAmount,
    useAssets,
    useAssetsContext,
    useTokenDenomReward,
} from "@bze/bze-ui-kit";

import {holdersPoolApr, holdersPoolPrizes, type HoldersPoolPrize, sortPrizesByUsd} from "@/lib/token-site/holders-pool";

// Same cadence as the reward programs next to it.
const RELOAD_INTERVAL = 150_000;

interface SchedulesState {
    key: string;
    /** Undefined when the schedules could not be read. */
    list?: DenomRewardSchedule[];
}

export interface HoldersPool {
    /** The pool with the viewer's position and unlocks; undefined when T has none (or still loading). */
    item?: DenomRewardHolderItem;
    /** Running rewards in display units, by USD paid per day; undefined while unknown. */
    prizes?: HoldersPoolPrize[];
    /** Estimated APR in percent; undefined when it can't be told (R5). */
    apr?: BigNumber;
    /** USD per display unit of each denom. */
    prices: ReadonlyMap<string, BigNumber>;
    isLoading: boolean;
    /** The pool itself could not be read (node down, or not on chain v8.2.0 yet). */
    hasError: boolean;
    /** Reloads the pool, its schedules and the viewer's position (after a transaction). */
    reload: () => Promise<void>;
}

/**
 * T's holders pool (Denom Rewards, Business Logic R5): the pool and the viewer's position from
 * ui-kit's `useTokenDenomReward`, plus the running schedules for the prize table and the APR.
 */
export function useHoldersPool(denom: string, address?: string): HoldersPool {
    const pool = useTokenDenomReward(denom, address);
    const {usdPricesMap} = useAssetsContext();
    const {denomDecimals} = useAssets();
    const [version, setVersion] = useState(0);
    const [schedules, setSchedules] = useState<SchedulesState>();

    // Only a token with a pool has schedules worth asking for.
    const hasPool = Boolean(pool.item);
    const key = `${denom}#${version}`;
    useEffect(() => {
        if (!hasPool) return;
        let cancelled = false;
        getDenomRewardSchedules(denom)
            .then((list) => {
                if (!cancelled) setSchedules({key, list});
            })
            .catch((e) => {
                console.error("failed to load the holders pool schedules of", denom, e);
                if (!cancelled) setSchedules({key});
            });

        return () => { cancelled = true; };
    }, [denom, key, hasPool]);

    const reloadPool = pool.reload;
    const reload = useCallback(async () => {
        setVersion((current) => current + 1);
        await reloadPool();
    }, [reloadPool]);

    useEffect(() => {
        const interval = setInterval(() => void reload(), RELOAD_INTERVAL);
        return () => clearInterval(interval);
    }, [reload]);

    // Keep showing the previous schedules while a reload is in flight.
    const list = schedules?.key.startsWith(`${denom}#`) ? schedules.list : undefined;
    const schedulesLoading = !schedules?.key.startsWith(`${denom}#`);

    const prizes = useMemo(() => {
        if (!list) return undefined;
        const display = holdersPoolPrizes(list).map((prize) => ({
            ...prize,
            daily: uAmountToBigNumberAmount(prize.daily, denomDecimals(prize.denom)),
        }));

        return sortPrizesByUsd(display, usdPricesMap);
    }, [list, denomDecimals, usdPricesMap]);

    const denomReward = pool.item?.denomReward;
    const apr = useMemo(() => {
        if (!prizes || !denomReward) return undefined;
        const staked = uAmountToBigNumberAmount(denomReward.staked_amount, denomDecimals(denom));

        return holdersPoolApr(prizes, staked, usdPricesMap, usdPricesMap.get(denom));
    }, [prizes, denomReward, denomDecimals, denom, usdPricesMap]);

    return {
        item: pool.item,
        prizes,
        apr,
        prices: usdPricesMap,
        isLoading: pool.isLoading || (hasPool && schedulesLoading),
        hasError: pool.hasError,
        reload,
    };
}
