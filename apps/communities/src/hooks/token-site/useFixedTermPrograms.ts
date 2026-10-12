'use client';

import {useEffect, useMemo} from "react";

import {useRewardsStakingData} from "@/hooks/useRewardsStakingData";
import {type FixedTermProgram, fixedTermPrograms} from "@/lib/token-site/fixed-term";

// Same cadence as the DEX staking page and the holders pool.
const RELOAD_INTERVAL = 150_000;

export interface FixedTermPrograms {
    programs: FixedTermProgram[];
    isLoading: boolean;
    /** Reloads the programs and the viewer's positions (after a transaction). */
    reload: () => Promise<void>;
}

/**
 * The fixed-term programs staking T (Business Logic R6) with the viewer's stake, pending prize
 * and unlocks; without `address` nobody's position counts, so finished programs stay hidden.
 */
export function useFixedTermPrograms(denom: string, address?: string): FixedTermPrograms {
    const {rewards, addressData, isLoading, reload} = useRewardsStakingData();

    // The positions are only the viewer's once they were loaded for that address.
    const mine = address && addressData?.address === address ? addressData : undefined;
    const programs = useMemo(() => fixedTermPrograms(rewards, denom, mine), [rewards, denom, mine]);

    useEffect(() => {
        const interval = setInterval(() => void reload(), RELOAD_INTERVAL);
        return () => clearInterval(interval);
    }, [reload]);

    return {programs, isLoading, reload};
}
