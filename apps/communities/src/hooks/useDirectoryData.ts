'use client';

import {useEffect, useState} from "react";
import {
    type DenomBranding,
    type DenomReward,
    getAllDenomBranding,
    getAllDenomRewards,
    getStakingRewards,
} from "@bze/bze-ui-kit";

import {createBrandKitListCache} from "@/lib/brand-kit";
import type {StakingRewardLike} from "@/lib/directory-facts";

const brandKits = createBrandKitListCache(getAllDenomBranding);

export interface DirectoryData {
    /** Brand kit per denom; empty while loading or when the query failed (neutral cards). */
    kits: ReadonlyMap<string, DenomBranding>;
    /** Every holders pool (DR); empty while loading or when the query failed. */
    denomRewards: DenomReward[];
    /** Every reward program (SR), finished ones included; empty while loading or on failure. */
    stakingRewards: StakingRewardLike[];
    isLoading: boolean;
}

const loadDenomRewards = async (): Promise<DenomReward[]> => {
    try {
        return await getAllDenomRewards();
    } catch (e) {
        console.error("failed to load the denom rewards", e);
        return [];
    }
};

/**
 * The chain data the token directory needs on top of the assets context: brand kits (cached for
 * a few minutes), holders pools and reward programs. Every source fails open to "none".
 */
export function useDirectoryData(): DirectoryData {
    const [data, setData] = useState<DirectoryData>({
        kits: new Map(),
        denomRewards: [],
        stakingRewards: [],
        isLoading: true,
    });

    useEffect(() => {
        let cancelled = false;

        Promise.all([brandKits.get(), loadDenomRewards(), getStakingRewards()]).then(([kits, denomRewards, sr]) => {
            if (cancelled) return;
            setData({kits, denomRewards, stakingRewards: sr.list ?? [], isLoading: false});
        });

        return () => { cancelled = true; };
    }, []);

    return data;
}
