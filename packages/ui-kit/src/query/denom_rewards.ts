import {PageRequest} from "@bze/bzejs/cosmos/base/query/v1beta1/pagination";
import {getRestClient} from "./client";
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

const PAGE_LIMIT = 500;
// Hard stop for a misbehaving node that keeps returning a next_key.
const MAX_PAGES = 50;

type LcdPagination = { next_key?: string | null } | undefined;

const base64ToBytes = (value: string): Uint8Array =>
    Uint8Array.from(atob(value), c => c.charCodeAt(0));

/** Reads every page of a paginated route by following `pagination.next_key`. */
async function readAllPages<T>(
    fetchPage: (pagination: PageRequest) => Promise<{ list?: T[]; pagination?: LcdPagination }>
): Promise<T[]> {
    const all: T[] = [];
    let key: Uint8Array | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
        const response = await fetchPage(PageRequest.fromPartial({key, limit: BigInt(PAGE_LIMIT)}));
        all.push(...(response.list ?? []));
        const nextKey = response.pagination?.next_key;
        if (!nextKey) break;
        key = base64ToBytes(nextKey);
    }

    return all;
}

/** gRPC NotFound reaches REST as HTTP 404 with `code: 5` in the body. */
function isNotFound(e: unknown): boolean {
    const response = (e as { response?: { status?: number; data?: { code?: number } } })?.response;
    return response?.status === 404 || response?.data?.code === 5;
}

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
