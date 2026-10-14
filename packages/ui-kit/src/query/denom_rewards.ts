import {getRestClient} from "./client";
import {isNotFound, LcdPagination, readAllPages} from "./lcd";
import {getAddressPendingUnlock} from "./rewards";
import {parsePendingUnlockIndex} from "../utils/denom_rewards";
import {
    DenomReward,
    DenomRewardParticipant,
    DenomRewardPosition,
    DenomRewardPrize,
    DenomRewardSchedule,
    DenomRewardUnlock,
} from "../types/denom_rewards";

/**
 * Denom Rewards queries (chain v8.2.0). The denom always travels as the `?denom=` query string —
 * factory and IBC denoms contain `/`, which a path segment can't carry (BZE-140); bzejs' LCD
 * client does that for these routes. On a node older than v8.2.0 every route answers HTTP 501.
 */

/**
 * The denom reward of `denom`, or `undefined` when the denom has none. Any other failure (node
 * down, pre-v8.2.0 node answering 501) is thrown, so callers never mistake an error for "no DR".
 */
export async function getDenomReward(denom: string): Promise<DenomReward | undefined> {
    try {
        const client = await getRestClient();
        const response = await client.bze.rewards.denomReward({denom});
        return response.denom_reward as unknown as DenomReward;
    } catch (e) {
        if (isNotFound(e)) {
            return undefined;
        }
        throw e;
    }
}

/** Every denom reward on the chain. Throws when the query fails. */
export async function getAllDenomRewards(): Promise<DenomReward[]> {
    const client = await getRestClient();
    return readAllPages<DenomReward>(async (pagination) =>
        (await client.bze.rewards.denomRewardAll({pagination})) as unknown as { list?: DenomReward[]; pagination?: LcdPagination }
    );
}

/**
 * Every prize denom ever used on the DR of `denom` (bounded by `max_prize_denoms_per_dr`, so the
 * route is not paginated). Throws when the query fails.
 */
export async function getDenomRewardPrizes(denom: string): Promise<DenomRewardPrize[]> {
    const client = await getRestClient();
    const response = await client.bze.rewards.denomRewardPrizes({denom});
    return (response.list ?? []) as unknown as DenomRewardPrize[];
}

/** The running schedules of the DR of `denom`. Throws when the query fails. */
export async function getDenomRewardSchedules(denom: string): Promise<DenomRewardSchedule[]> {
    const client = await getRestClient();
    return readAllPages<DenomRewardSchedule>(async (pagination) =>
        (await client.bze.rewards.denomRewardSchedules({denom, pagination})) as unknown as { list?: DenomRewardSchedule[]; pagination?: LcdPagination }
    );
}

/**
 * The position of `address` in the DR of `denom` with its claimable coins, or `undefined` when the
 * address has no position there. Other failures are thrown.
 */
export async function getDenomRewardParticipant(address: string, denom: string): Promise<DenomRewardPosition | undefined> {
    try {
        const client = await getRestClient();
        const response = await client.bze.rewards.denomRewardParticipant({address, denom}) as unknown as Partial<DenomRewardPosition>;
        if (!response.participant) {
            return undefined;
        }
        return {participant: response.participant, pending: response.pending ?? []};
    } catch (e) {
        if (isNotFound(e)) {
            return undefined;
        }
        throw e;
    }
}

/** Every DR position of `address`. Throws when the query fails. */
export async function getDenomRewardParticipations(address: string): Promise<DenomRewardParticipant[]> {
    const client = await getRestClient();
    return readAllPages<DenomRewardParticipant>(async (pagination) =>
        (await client.bze.rewards.denomRewardParticipations({address, pagination})) as unknown as { list?: DenomRewardParticipant[]; pagination?: LcdPagination }
    );
}

/**
 * The stakes `address` exited from denom rewards that are still locked, read from the shared
 * pending-unlock store (index `<epoch>/dr/<denom>/<address>`). Empty when the query fails.
 */
export async function getAddressDenomRewardUnlocks(address: string): Promise<DenomRewardUnlock[]> {
    if (!address) return [];

    const pending = await getAddressPendingUnlock(address);
    const result: DenomRewardUnlock[] = [];
    for (const entry of pending) {
        const parsed = parsePendingUnlockIndex(entry.index);
        if (parsed?.kind !== 'denom-reward') continue;
        result.push({staking_denom: parsed.denom, amount: entry.amount, unlockEpoch: parsed.epoch});
    }

    return result;
}
