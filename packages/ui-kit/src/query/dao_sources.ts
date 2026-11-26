import {getRestClient} from "./client";
import {LcdPagination, readAllPages} from "./lcd";
import {getAllDenomRewards} from "./denom_rewards";
import {getSettings} from "../storage/settings";
import {DaoStakeSource} from "../utils/dao/create-sources";

interface RawStakingReward {
    reward_id: string;
    staking_denom: string;
    lock: number;
    staked_amount: string;
}

/**
 * Every staking reward and Denom Reward a DAO could vote with, all pages. Unlike the app-wide
 * reward reads this one throws on any failure, so an outage never reads as "nothing staked".
 */
export const getDaoStakeSources = async (): Promise<DaoStakeSource[]> => {
    const client = await getRestClient();
    const [staking, denomRewards] = await Promise.all([
        readAllPages<RawStakingReward>(async (pagination) =>
            (await client.bze.rewards.allStakingRewards({pagination})) as unknown as {list?: RawStakingReward[]; pagination?: LcdPagination}),
        getAllDenomRewards(),
    ]);

    return [
        ...denomRewards.map((r): DaoStakeSource => ({kind: 'dr', id: r.staking_denom, stakingDenom: r.staking_denom, lock: Number(r.lock), staked: r.staked_amount})),
        ...staking.map((r): DaoStakeSource => ({kind: 'sr', id: r.reward_id, stakingDenom: r.staking_denom, lock: Number(r.lock), staked: r.staked_amount})),
    ];
}

/** The events of a transaction from the node's REST gateway (for a response that carries none). */
export const getTxEvents = async (txHash: string): Promise<unknown> => {
    const resp = await fetch(`${getSettings().endpoints.restEndpoint}/cosmos/tx/v1beta1/txs/${encodeURIComponent(txHash)}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const body = await resp.json();
    return body?.tx_response?.events;
}

/**
 * Where a broadcast transaction stands: `landed` (in a block, code 0), `failed` (in a block, refused
 * by the chain, so nothing happened), `notfound` (the node does not know it, yet). Throws when the node
 * cannot be asked.
 */
export type TxLanding = 'landed' | 'failed' | 'notfound';

export const getTxLanding = async (txHash: string): Promise<TxLanding> => {
    const resp = await fetch(`${getSettings().endpoints.restEndpoint}/cosmos/tx/v1beta1/txs/${encodeURIComponent(txHash)}`);
    if (resp.status === 404 || resp.status === 400) return 'notfound';
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const body = await resp.json();
    return Number(body?.tx_response?.code ?? 0) === 0 ? 'landed' : 'failed';
}
