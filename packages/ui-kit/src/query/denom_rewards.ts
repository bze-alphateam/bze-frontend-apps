import {PageRequest} from "@bze/bzejs/cosmos/base/query/v1beta1/pagination";
import {getRestClient} from "./client";
import {DenomReward, DenomRewardPrize, DenomRewardSchedule} from "../types/denom_rewards";

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
