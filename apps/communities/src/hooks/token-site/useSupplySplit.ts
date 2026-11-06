'use client';

import {useCallback, useMemo} from "react";
import {useQuery} from "@tanstack/react-query";
import {getDenomReward, getStakingRewards} from "@bze/bze-ui-kit";

import {useScanAccount, useScanModules} from "@/hooks/token-activity";
import type {ScanAccount, ScanHolder} from "@/lib/token-activity";
import {type SupplyPart, supplySplit} from "@/lib/token-activity/supply-split";

/** What T has staked, base units: the holders pool's total and each program staking T. */
interface StakedTotals {
    pool: string;
    programs: string[];
}

/**
 * The same chain reads as the token page's Stake section: T's holders pool (`staked_amount`) and
 * every fixed-term program whose staking denom is T, finished ones included, since their stakes
 * still sit in the rewards module until they leave.
 */
async function loadStakedTotals(denom: string): Promise<StakedTotals> {
    const [denomReward, programs] = await Promise.all([getDenomReward(denom), getStakingRewards()]);

    return {
        pool: denomReward?.staked_amount ?? "0",
        programs: programs.list.filter((program) => program.staking_denom === denom).map((program) => program.staked_amount),
    };
}

/** T's balance in a module account; undefined while unread or when the node didn't answer. */
const moduleBalance = (account: ScanAccount | undefined, denom: string): string | undefined => {
    if (!account?.live.available) return undefined;

    return account.balances.find((balance) => balance.denom === denom)?.amount ?? "0";
};

export interface SupplySplitState {
    /** Undefined until every part can be worked out. */
    parts?: SupplyPart[];
    isLoading: boolean;
    isError: boolean;
    retry: () => void;
}

/**
 * "Where the T is" (Holders tab): staked, reward budgets, on the DEX, top 10 and the rest of the
 * supply, worked out from the rewards reads, the rewards and tradebin module balances (BZE Scan
 * `/accounts/{module}`, live from the node) and the first page of the holders snapshot.
 */
export function useSupplySplit(denom: string, supply: string | null | undefined, holders: ScanHolder[] | undefined): SupplySplitState {
    const staked = useQuery({
        queryKey: ["token-site", "staked-totals", denom],
        queryFn: () => loadStakedTotals(denom),
        enabled: Boolean(denom),
    });
    const modules = useScanModules();
    const addressOf = (module: string) => modules.data?.items.find((item) => item.module === module)?.address;
    const rewardsAddress = addressOf("rewards");
    const dexAddress = addressOf("tradebin");
    const rewards = useScanAccount(rewardsAddress);
    const dex = useScanAccount(dexAddress);

    const rewardsBalance = moduleBalance(rewards.data, denom);
    const dexBalance = moduleBalance(dex.data, denom);
    const unavailable = (rewards.data && rewardsBalance === undefined) || (dex.data && dexBalance === undefined);
    const modulesMissing = modules.data !== undefined && (!rewardsAddress || !dexAddress);

    const parts = useMemo(() => {
        if (!staked.data || rewardsBalance === undefined || dexBalance === undefined || !holders || !supply) return undefined;

        return supplySplit({
            supply,
            holdersPoolStaked: staked.data.pool,
            programsStaked: staked.data.programs,
            rewardsModuleBalance: rewardsBalance,
            dexModuleBalance: dexBalance,
            holders,
        });
    }, [staked.data, rewardsBalance, dexBalance, holders, supply]);

    const isError = staked.isError || modules.isError || rewards.isError || dex.isError || Boolean(unavailable) || modulesMissing;

    // A disabled query still runs on refetch, so a module account is only asked for once known.
    const {refetch: refetchStaked} = staked;
    const {refetch: refetchModules} = modules;
    const {refetch: refetchRewards} = rewards;
    const {refetch: refetchDex} = dex;
    const retry = useCallback(() => {
        void refetchStaked();
        void refetchModules();
        if (rewardsAddress) void refetchRewards();
        if (dexAddress) void refetchDex();
    }, [refetchStaked, refetchModules, refetchRewards, refetchDex, rewardsAddress, dexAddress]);

    return {parts, isLoading: !parts && !isError, isError, retry};
}
