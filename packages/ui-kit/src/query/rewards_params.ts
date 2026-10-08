import { getRestClient } from "./client";
import { getFromLocalStorage, setInLocalStorage } from "../storage/storage";
import { FeeCoin } from "../types/fees";

// _v2: entries written before the TTL fix carry a ~3.5-day expiry; the new key ignores them.
const CACHE_KEY = "rewards_params_v2";
const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes — setInLocalStorage takes seconds

export interface RewardsParamsCache {
    createStakingRewardFee: FeeCoin;
    createTradingRewardFee: FeeCoin;
}

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
        const staking = response?.params?.createStakingRewardFee;
        const trading = response?.params?.createTradingRewardFee;
        if (staking?.denom && staking?.amount && trading?.denom && trading?.amount) {
            const params: RewardsParamsCache = {
                createStakingRewardFee: { denom: staking.denom, amount: staking.amount },
                createTradingRewardFee: { denom: trading.denom, amount: trading.amount },
            };
            setInLocalStorage(CACHE_KEY, JSON.stringify(params), CACHE_TTL_SECONDS);
            return params;
        }
    } catch (e) {
        console.error("failed to fetch rewards params:", e);
    }

    return undefined;
}
