import { getRestClient } from "./client";
import { getFromLocalStorage, setInLocalStorage } from "../storage/storage";
import { FeeCoin } from "../types/fees";

// _v3: the cached shape gained the Denom Rewards fields (chain v8.2.0). _v2 entries (BFE-105,
// written before the TTL fix as _v1) lack them and are ignored.
const CACHE_KEY = "rewards_params_v3";
const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes — setInLocalStorage takes seconds

export interface RewardsParamsCache {
    createStakingRewardFee: FeeCoin;
    createTradingRewardFee: FeeCoin;
    // Denom Rewards (chain v8.2.0). Undefined on an older node that doesn't know them.
    /** MsgCreateDenomReward. */
    createDenomRewardFee?: FeeCoin;
    /** Charged once per prize denom new to a DR (by MsgCreateDenomRewardSchedule / MsgDistributeDenomRewards). */
    createDenomRewardPrizeFee?: FeeCoin;
    /** MsgCreateDenomRewardSchedule (flat, on top of the escrowed budget). */
    addDenomRewardScheduleFee?: FeeCoin;
    /** How many distinct prize denoms one DR may ever have. */
    maxPrizeDenomsPerDr?: number;
    /** Extra gas the chain charges a MsgExitDenomReward on top of its own use (uint64 as string). */
    extraGasForDenomExit?: string;
    /** Lock in days a new DR snapshots at creation. */
    denomRewardLock?: number;
    /** Min stake (staking denom base units, uint64 as string) a new DR snapshots at creation. */
    denomRewardMinStake?: string;
}

const toFeeCoin = (coin?: { denom?: string; amount?: string }): FeeCoin | undefined =>
    coin?.denom && coin?.amount ? { denom: coin.denom, amount: coin.amount } : undefined;

// The LCD client returns the raw JSON: uint32 → number, uint64 → string.
const toNumber = (value: unknown): number | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
};

const toUintString = (value: unknown): string | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    const s = String(value);
    return /^\d+$/.test(s) ? s : undefined;
};

export const getRewardsParams = async (): Promise<RewardsParamsCache | undefined> => {
    const cached = getFromLocalStorage(CACHE_KEY);
    if (cached) {
        try {
            return JSON.parse(cached) as RewardsParamsCache;
        } catch {
            // ignore parse error, refetch
        }
    }

    try {
        const client = await getRestClient();
        const response = await client.bze.rewards.params();
        const raw = response?.params as unknown as Record<string, unknown> | undefined;
        const staking = toFeeCoin(raw?.createStakingRewardFee as FeeCoin | undefined);
        const trading = toFeeCoin(raw?.createTradingRewardFee as FeeCoin | undefined);
        if (staking && trading) {
            const params: RewardsParamsCache = {
                createStakingRewardFee: staking,
                createTradingRewardFee: trading,
                createDenomRewardFee: toFeeCoin(raw?.createDenomRewardFee as FeeCoin | undefined),
                createDenomRewardPrizeFee: toFeeCoin(raw?.createDenomRewardPrizeFee as FeeCoin | undefined),
                addDenomRewardScheduleFee: toFeeCoin(raw?.addDenomRewardScheduleFee as FeeCoin | undefined),
                maxPrizeDenomsPerDr: toNumber(raw?.maxPrizeDenomsPerDr),
                extraGasForDenomExit: toUintString(raw?.extraGasForDenomExit),
                denomRewardLock: toNumber(raw?.denomRewardLock),
                denomRewardMinStake: toUintString(raw?.denomRewardMinStake),
            };
            setInLocalStorage(CACHE_KEY, JSON.stringify(params), CACHE_TTL_SECONDS);
            return params;
        }
    } catch (e) {
        console.error("failed to fetch rewards params:", e);
    }

    return undefined;
}
