'use client';

import {useCallback, useEffect, useState} from "react";
import type {StakingRewardParticipantSDKType} from "@bze/bzejs/bze/rewards/store";
import {type DenomRewardParticipant, getDenomRewardParticipations, getStakingRewardParticipantByAddress} from "@bze/bze-ui-kit";

import type {EarnPositions} from "@/lib/token-site/earn";

/** The address-wide reads the positions need — injected so the loader can run against mocks. */
export interface EarnPositionsQueries {
    getDenomRewardParticipations: (address: string) => Promise<DenomRewardParticipant[]>;
    getStakingRewardParticipants: (address: string) => Promise<StakingRewardParticipantSDKType[]>;
}

const chainQueries: EarnPositionsQueries = {
    getDenomRewardParticipations,
    getStakingRewardParticipants: async (address) => (await getStakingRewardParticipantByAddress(address)).list,
};

/**
 * Every holders pool and program stake of `address`: two reads in all, never one per row. A
 * failed read only drops its half.
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

    return {pools, programs};
}

interface Loaded extends EarnPositions {
    address: string;
}

export interface EarnPositionsResult {
    /** Undefined without an address or until loaded. */
    positions?: EarnPositions;
    /** Reads them again (after a stake or an unstake). */
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
