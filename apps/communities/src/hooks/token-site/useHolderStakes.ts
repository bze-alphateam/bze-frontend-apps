'use client';

import {useMemo} from "react";
import {useQuery} from "@tanstack/react-query";
import {getAddressStakingRewards, getStakingRewards, useTokenDenomReward} from "@bze/bze-ui-kit";

import {holderStakePositions, type StakePosition} from "@/lib/token-activity/holder-stakes";

export interface HolderStakes {
    positions: StakePosition[];
    isLoading: boolean;
    /** The holders pool could not be read; the programs may still show. */
    isError: boolean;
}

/**
 * Where a holder (any address, not only the viewer) stakes T: T's holders pool for that address
 * (ui-kit `useTokenDenomReward`) and the fixed-term programs staking T it is in.
 */
export function useHolderStakes(denom: string, address: string): HolderStakes {
    const pool = useTokenDenomReward(denom, address);
    const programs = useQuery({
        queryKey: ["token-site", "holder-programs", address],
        queryFn: async () => {
            const [all, staking] = await Promise.all([getStakingRewards(), getAddressStakingRewards(address)]);
            return {programs: all.list, staking};
        },
        enabled: Boolean(address),
    });

    const positions = useMemo(
        () => holderStakePositions({denom, pool: pool.item, programs: programs.data?.programs ?? [], staking: programs.data?.staking}),
        [denom, pool.item, programs.data],
    );

    return {positions, isLoading: pool.isLoading || programs.isPending, isError: pool.hasError || programs.isError};
}
