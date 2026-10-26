import {useCallback, useEffect, useState} from "react";
import {
    getAddressDenomRewardUnlocks,
    getAllDenomRewards,
    getDenomRewardParticipant,
    getDenomRewardParticipations,
    getDenomRewardSchedules,
} from "../query/denom_rewards";
import {
    DenomReward,
    DenomRewardParticipant,
    DenomRewardPosition,
    DenomRewardSchedule,
    DenomRewardUnlock,
} from "../types/denom_rewards";
import {DenomRewardHolderItem, sortDenomRewardItems, summarizeDailyPrizes} from "../utils/denom_rewards";

/** The chain reads the holder view needs — injected so the loader can run against mocks. */
export interface DenomRewardsQueries {
    getAllDenomRewards: () => Promise<DenomReward[]>;
    getDenomRewardSchedules: (denom: string) => Promise<DenomRewardSchedule[]>;
    getDenomRewardParticipations: (address: string) => Promise<DenomRewardParticipant[]>;
    getDenomRewardParticipant: (address: string, denom: string) => Promise<DenomRewardPosition | undefined>;
    getAddressDenomRewardUnlocks: (address: string) => Promise<DenomRewardUnlock[]>;
}

const chainQueries: DenomRewardsQueries = {
    getAllDenomRewards,
    getDenomRewardSchedules,
    getDenomRewardParticipations,
    getDenomRewardParticipant,
    getAddressDenomRewardUnlocks,
};

/**
 * Every DR with what it pays per day and, for `address`, the positions (with the chain's own
 * claimable coins) and locked exits, in holder order. The DR list query failing throws; a failed
 * schedules read leaves that DR's `dailyPrizes` unknown, and a failed position read drops the
 * address part (the list stays usable).
 */
export async function loadDenomRewardsData(
    address: string | undefined,
    queries: DenomRewardsQueries = chainQueries,
): Promise<DenomRewardHolderItem[]> {
    const loadAddressData = async (): Promise<{ positions: Map<string, DenomRewardPosition>; unlocks: DenomRewardUnlock[] }> => {
        const positions = new Map<string, DenomRewardPosition>();
        if (!address) return {positions, unlocks: []};

        try {
            const [participations, unlocks] = await Promise.all([
                queries.getDenomRewardParticipations(address),
                queries.getAddressDenomRewardUnlocks(address),
            ]);
            const loaded = await Promise.all(
                participations.map(p => queries.getDenomRewardParticipant(address, p.staking_denom))
            );
            loaded.forEach(position => {
                if (position) positions.set(position.participant.staking_denom, position);
            });
            return {positions, unlocks};
        } catch (e) {
            console.error('failed to load the denom reward positions of', address, e);
            return {positions, unlocks: []};
        }
    };

    const [all, addressData] = await Promise.all([queries.getAllDenomRewards(), loadAddressData()]);
    const items = await Promise.all(all.map(async (denomReward): Promise<DenomRewardHolderItem> => {
        let dailyPrizes: DenomRewardHolderItem['dailyPrizes'];
        try {
            dailyPrizes = summarizeDailyPrizes(await queries.getDenomRewardSchedules(denomReward.staking_denom));
        } catch (e) {
            console.error('failed to load the denom reward schedules of', denomReward.staking_denom, e);
        }

        return {
            denomReward,
            dailyPrizes,
            position: addressData.positions.get(denomReward.staking_denom),
            unlocks: addressData.unlocks.filter(u => u.staking_denom === denomReward.staking_denom),
        };
    }));

    return sortDenomRewardItems(items);
}

export interface UseDenomRewardsDataResult {
    items: DenomRewardHolderItem[];
    isLoading: boolean;
    /** The DR list could not be read (node down, or not on chain v8.2.0 yet). */
    hasError: boolean;
    reload: () => Promise<void>;
}

/** The holder view of every denom reward for `address` (no address: the list without positions). */
export function useDenomRewardsData(address?: string): UseDenomRewardsDataResult {
    const [items, setItems] = useState<DenomRewardHolderItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const reload = useCallback(async () => {
        try {
            setItems(await loadDenomRewardsData(address));
            setHasError(false);
        } catch (e) {
            console.error('failed to load the denom rewards', e);
            setHasError(true);
        } finally {
            setIsLoading(false);
        }
    }, [address]);

    useEffect(() => {
        void reload();
    }, [reload]);

    return {items, isLoading, hasError, reload};
}
