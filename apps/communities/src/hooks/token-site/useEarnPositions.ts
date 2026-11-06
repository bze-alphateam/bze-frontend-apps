'use client';

import {useCallback, useEffect, useState} from "react";
import BigNumber from "bignumber.js";
import type {StakingRewardParticipantSDKType} from "@bze/bzejs/bze/rewards/store";
import {
    claimableCoins,
    type DenomRewardCoin,
    type DenomRewardParticipant,
    type DenomRewardPosition,
    getDenomRewardParticipant,
    getDenomRewardParticipations,
    getStakingRewardParticipantByAddress,
} from "@bze/bze-ui-kit";

import type {EarnPositions} from "@/lib/token-site/earn";

/** The reads the positions need — injected so the loader can run against mocks. */
export interface EarnPositionsQueries {
    getDenomRewardParticipations: (address: string) => Promise<DenomRewardParticipant[]>;
    /** One holders pool position with its claimable coins; undefined without one. */
    getDenomRewardParticipant: (address: string, denom: string) => Promise<DenomRewardPosition | undefined>;
    getStakingRewardParticipants: (address: string) => Promise<StakingRewardParticipantSDKType[]>;
}

const chainQueries: EarnPositionsQueries = {
    getDenomRewardParticipations,
    getDenomRewardParticipant,
    getStakingRewardParticipants: async (address) => (await getStakingRewardParticipantByAddress(address)).list,
};

/**
 * Every holders pool and program stake of `address`, with what each lets them claim: two
 * address-wide reads, then one per holders pool they stake in (a program's pending is computed
 * from the program itself) — never one per row. A failed read only drops its half, or that one
 * pool's pending.
 */
export async function loadEarnPositions(address: string, queries: EarnPositionsQueries = chainQueries): Promise<EarnPositions> {
    const read = async <T>(what: string, query: () => Promise<T[]>): Promise<T[]> => {
        try {
            return await query();
        } catch (e) {
            console.error("failed to load the", what, "of", address, e);
            return [];
        }
    };

    const [pools, programs] = await Promise.all([
        read("holders pool stakes", () => queries.getDenomRewardParticipations(address)),
        read("program stakes", () => queries.getStakingRewardParticipants(address)),
    ]);

    const poolPending = new Map<string, DenomRewardCoin[]>();
    await Promise.all(pools.filter((pool) => new BigNumber(pool.amount).gt(0)).map(async (pool) => {
        try {
            poolPending.set(pool.staking_denom, claimableCoins(await queries.getDenomRewardParticipant(address, pool.staking_denom)));
        } catch (e) {
            console.error("failed to load the holders pool rewards of", address, "in", pool.staking_denom, e);
        }
    }));

    return {pools, programs, poolPending};
}

interface Loaded extends EarnPositions {
    address: string;
}

export interface EarnPositionsResult {
    /** Undefined without an address or until loaded. */
    positions?: EarnPositions;
    /** Reads them again, pending rewards included (after a stake, a claim or an unstake). */
    reload: () => void;
}

/** The viewer's stakes in the ways to earn T; no address reads nothing. */
export function useEarnPositions(address: string | undefined): EarnPositionsResult {
    const [loaded, setLoaded] = useState<Loaded>();
    const [version, setVersion] = useState(0);

    useEffect(() => {
        if (!address) return;
        let current = true;
        void loadEarnPositions(address).then((positions) => {
            if (current) setLoaded({address, ...positions});
        });

        return () => {
            current = false;
        };
    }, [address, version]);

    const reload = useCallback(() => setVersion((value) => value + 1), []);

    // Never the previous wallet's stakes.
    const positions = address && loaded?.address === address ? loaded : undefined;

    return {positions, reload};
}
