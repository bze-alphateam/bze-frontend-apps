'use client';

import {useCallback, useMemo} from "react";
import {useChain} from "@interchain-kit/react";
import {getChainName, useTokenDenomReward} from "@bze/bze-ui-kit";

import {useRewardsStakingData} from "@/hooks/useRewardsStakingData";
import {type TokenWalletPositions, tokenWalletPositions} from "@/lib/token-site/wallet";

export interface UseTokenWalletPositions {
    positions: TokenWalletPositions;
    isLoading: boolean;
    /** Reloads the holders pool and the programs (after a claim). */
    reload: () => Promise<void>;
}

/** The connected wallet's T positions across the holders pool and the programs staking T. */
export function useTokenWalletPositions(denom: string): UseTokenWalletPositions {
    const {address} = useChain(getChainName());
    const holdersPool = useTokenDenomReward(denom, address);
    const programs = useRewardsStakingData();

    const positions = useMemo(() => tokenWalletPositions({
        denom,
        holdersPool: holdersPool.item,
        programs: programs.rewards,
        addressPrograms: programs.addressData,
    }), [denom, holdersPool.item, programs.rewards, programs.addressData]);

    const reloadHoldersPool = holdersPool.reload;
    const reloadPrograms = programs.reload;
    const reload = useCallback(async () => {
        await Promise.all([reloadHoldersPool(), reloadPrograms()]);
    }, [reloadHoldersPool, reloadPrograms]);

    return {positions, isLoading: holdersPool.isLoading || programs.isLoading, reload};
}
