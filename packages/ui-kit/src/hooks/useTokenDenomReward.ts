import {useCallback, useEffect, useState} from "react";
import {
    getAddressDenomRewardUnlocks,
    getDenomReward,
    getDenomRewardParticipant,
    getDenomRewardPrizes,
    getDenomRewardSchedules,
} from "../query/denom_rewards";
import {
    DenomReward,
    DenomRewardPosition,
    DenomRewardPrize,
    DenomRewardSchedule,
    DenomRewardUnlock,
} from "../types/denom_rewards";
import {DenomRewardHolderItem, summarizeDailyPrizes} from "../utils/denom_rewards";

/** The chain reads a single token's DR view needs — injected so the loader can run against mocks. */
export interface TokenDenomRewardQueries {
    getDenomReward: (denom: string) => Promise<DenomReward | undefined>;
    getDenomRewardSchedules: (denom: string) => Promise<DenomRewardSchedule[]>;
    getDenomRewardPrizes: (denom: string) => Promise<DenomRewardPrize[]>;
    getDenomRewardParticipant: (address: string, denom: string) => Promise<DenomRewardPosition | undefined>;
    getAddressDenomRewardUnlocks: (address: string) => Promise<DenomRewardUnlock[]>;
}

const chainQueries: TokenDenomRewardQueries = {
    getDenomReward,
    getDenomRewardSchedules,
    getDenomRewardPrizes,
    getDenomRewardParticipant,
    getAddressDenomRewardUnlocks,
};

export interface TokenDenomReward {
    /** The holder view of the DR whose staking denom is the token; `undefined` when it has none. */
    item?: DenomRewardHolderItem;
    /** Every prize denom ever used on that DR (running or airdropped); empty when unknown. */
    prizeDenoms: string[];
}

/**
 * The DR of `denom` as a holder of that token sees it: what it pays per day, every prize denom in
 * play and, for `address`, the position (with the chain's own pending) and locked exits. The DR
 * read failing throws (never mistaken for "no DR"); a failed schedules read leaves `dailyPrizes`
 * unknown, a failed prizes read leaves `prizeDenoms` empty and a failed address read drops only
 * the address part.
 */
export async function loadTokenDenomReward(
    denom: string,
    address: string | undefined,
    queries: TokenDenomRewardQueries = chainQueries,
): Promise<TokenDenomReward> {
    const denomReward = await queries.getDenomReward(denom);
    if (!denomReward) return {prizeDenoms: []};

    const loadDailyPrizes = async (): Promise<DenomRewardHolderItem['dailyPrizes']> => {
        try {
            return summarizeDailyPrizes(await queries.getDenomRewardSchedules(denom));
        } catch (e) {
            console.error('failed to load the denom reward schedules of', denom, e);
            return undefined;
        }
    };

    const loadPrizeDenoms = async (): Promise<string[]> => {
        try {
            return (await queries.getDenomRewardPrizes(denom)).map(p => p.prize_denom);
        } catch (e) {
            console.error('failed to load the denom reward prizes of', denom, e);
            return [];
        }
    };

    const loadAddressData = async (): Promise<Pick<DenomRewardHolderItem, 'position' | 'unlocks'>> => {
        if (!address) return {unlocks: []};
        try {
            const [position, unlocks] = await Promise.all([
                queries.getDenomRewardParticipant(address, denom),
                queries.getAddressDenomRewardUnlocks(address),
            ]);
            return {position, unlocks: unlocks.filter(u => u.staking_denom === denom)};
        } catch (e) {
            console.error('failed to load the denom reward position of', address, 'in', denom, e);
            return {unlocks: []};
        }
    };

    const [dailyPrizes, prizeDenoms, addressData] = await Promise.all([
        loadDailyPrizes(),
        loadPrizeDenoms(),
        loadAddressData(),
    ]);

    return {item: {denomReward, dailyPrizes, ...addressData}, prizeDenoms};
}

export interface UseTokenDenomRewardResult extends TokenDenomReward {
    isLoading: boolean;
    /** The DR could not be read (node down, or not on chain v8.2.0 yet). */
    hasError: boolean;
    reload: () => Promise<void>;
}

/** The DR of one token for `address` (no address: the DR without a position). */
export function useTokenDenomReward(denom: string, address?: string): UseTokenDenomRewardResult {
    const [data, setData] = useState<TokenDenomReward>({prizeDenoms: []});
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const reload = useCallback(async () => {
        try {
            setData(await loadTokenDenomReward(denom, address));
            setHasError(false);
        } catch (e) {
            console.error('failed to load the denom reward of', denom, e);
            setHasError(true);
        } finally {
            setIsLoading(false);
        }
    }, [denom, address]);

    useEffect(() => {
        void reload();
    }, [reload]);

    return {...data, isLoading, hasError, reload};
}
