'use client';

import {useCallback, useEffect, useMemo, useState} from "react";
import type {StakingRewardSDKType} from "@bze/bzejs/bze/rewards/store";
import {
    type DenomReward,
    type DenomRewardSchedule,
    getAllDenomRewards,
    getDenomRewardSchedules,
    getStakingRewards,
    useAssets,
    useAssetsContext,
} from "@bze/bze-ui-kit";

import {type EarnOpportunity, earnOpportunities, type PoolWithSchedules} from "@/lib/token-site/earn";

// The page's refresh cadence, same as the Stake section.
const RELOAD_INTERVAL = 150_000;

/** The chain reads the Earn section needs — injected so the loader can run against mocks. */
export interface EarnQueries {
    getStakingRewards: () => Promise<StakingRewardSDKType[]>;
    getAllDenomRewards: () => Promise<DenomReward[]>;
    getDenomRewardSchedules: (denom: string) => Promise<DenomRewardSchedule[]>;
}

const chainQueries: EarnQueries = {
    getStakingRewards: async () => (await getStakingRewards()).list,
    getAllDenomRewards,
    getDenomRewardSchedules,
};

export interface EarnSources {
    programs: StakingRewardSDKType[];
    pools: PoolWithSchedules[];
}

/**
 * What can pay T: every program, and every other token's pool with its schedules. The chain has
 * no by-prize query, so that is one schedules read per pool, all at once. A failed read only
 * drops what it was for: the programs, the pools, or that one pool.
 */
export async function loadEarnSources(denom: string, queries: EarnQueries = chainQueries): Promise<EarnSources> {
    const loadPrograms = async () => {
        try {
            return await queries.getStakingRewards();
        } catch (e) {
            console.error("failed to load the programs paying", denom, e);
            return [];
        }
    };

    const loadPool = async (denomReward: DenomReward): Promise<PoolWithSchedules | undefined> => {
        try {
            return {denomReward, schedules: await queries.getDenomRewardSchedules(denomReward.staking_denom)};
        } catch (e) {
            console.error("failed to load the holders pool schedules of", denomReward.staking_denom, e);
            return undefined;
        }
    };

    const loadPools = async () => {
        try {
            const others = (await queries.getAllDenomRewards()).filter((pool) => pool.staking_denom !== denom);
            const pools = await Promise.all(others.map(loadPool));
            return pools.filter((pool): pool is PoolWithSchedules => pool !== undefined);
        } catch (e) {
            console.error("failed to load the holders pools paying", denom, e);
            return [];
        }
    };

    const [programs, pools] = await Promise.all([loadPrograms(), loadPools()]);

    return {programs, pools};
}

interface Loaded extends EarnSources {
    denom: string;
}

export interface EarnOpportunities {
    /** Sorted as the section shows them; empty while loading. */
    opportunities: EarnOpportunity[];
    isLoading: boolean;
}

/** The places that pay T for staking another token (Business Logic R7); no denom loads nothing. */
export function useEarnOpportunities(denom: string | undefined): EarnOpportunities {
    const {usdPricesMap} = useAssetsContext();
    const {denomDecimals} = useAssets();
    const [loaded, setLoaded] = useState<Loaded>();
    const [version, setVersion] = useState(0);

    useEffect(() => {
        if (!denom) return;
        let current = true;
        void loadEarnSources(denom).then((sources) => {
            if (current) setLoaded({denom, ...sources});
        });

        return () => {
            current = false;
        };
    }, [denom, version]);

    const reload = useCallback(() => setVersion((value) => value + 1), []);
    useEffect(() => {
        const interval = setInterval(reload, RELOAD_INTERVAL);
        return () => clearInterval(interval);
    }, [reload]);

    // Keep showing the previous data while a reload is in flight.
    const data = denom && loaded?.denom === denom ? loaded : undefined;
    const opportunities = useMemo(
        () => (data && denom ? earnOpportunities(denom, data.programs, data.pools, usdPricesMap, denomDecimals) : []),
        [data, denom, usdPricesMap, denomDecimals],
    );

    return {opportunities, isLoading: Boolean(denom) && !data};
}
