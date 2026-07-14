import { getRestClient } from "./client";
import { getFromLocalStorage, setInLocalStorage } from "../storage/storage";
import { FeeCoin } from "../types/fees";

const CACHE_KEY = "rewards_params";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
            setInLocalStorage(CACHE_KEY, JSON.stringify(params), CACHE_TTL_MS);
            return params;
        }
    } catch (e) {
        console.error("failed to fetch rewards params:", e);
    }

    return undefined;
}
