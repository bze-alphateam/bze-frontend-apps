import BigNumber from "bignumber.js";
import {
    type Asset,
    type DenomReward,
    type LiquidityPoolData,
    type MarketData,
    createMarketId,
    uAmountToBigNumberAmount,
} from "@bze/bze-ui-kit";

import type {DirectoryFacts} from "./token-directory";

// Turns the chain data the directory loads into the per-token facts its filters, sort and cards
// read. Pure: the quote denoms come in as arguments, nothing is read from the environment.

/** The fields of a staking reward (SR) this module reads. */
export interface StakingRewardLike {
    staking_denom: string;
    payouts: number | bigint | string;
    duration: number | bigint | string;
}

/** The quote denoms prices and 24h changes are looked up against. */
export interface QuoteDenoms {
    usdc: string;
    native: string;
}

export interface TokenMarket {
    /** USD price, 0 when unknown. */
    price: BigNumber;
    /** 24h change in percent, `undefined` when the token has no USDC or BZE market. */
    change?: number;
}

/** Price and 24h change of `denom`, from the same sources as ui-kit's `useAssetPrice`. */
export function tokenMarket(
    denom: string,
    prices: ReadonlyMap<string, BigNumber>,
    marketsData: ReadonlyMap<string, MarketData>,
    quotes: QuoteDenoms,
): TokenMarket {
    const price = denom === quotes.usdc ? new BigNumber(1) : prices.get(denom) ?? new BigNumber(0);
    const market = marketsData.get(createMarketId(denom, quotes.usdc)) ?? marketsData.get(createMarketId(denom, quotes.native));

    return {price, change: market?.change};
}

/** An SR pays while it has payouts left. */
export const isActiveStakingReward = (sr: StakingRewardLike): boolean => Number(sr.payouts) < Number(sr.duration);

export interface DirectorySources {
    tokens: Asset[];
    denomRewards: DenomReward[];
    stakingRewards: StakingRewardLike[];
    pools: Iterable<{ base: string; quote: string }>;
    poolsData: Iterable<LiquidityPoolData>;
    prices: ReadonlyMap<string, BigNumber>;
    quotes: QuoteDenoms;
}

export function buildDirectoryFacts(sources: DirectorySources): DirectoryFacts {
    const holdersPool = new Set(sources.denomRewards.map((dr) => dr.staking_denom));
    const rewardPrograms = new Set(
        sources.stakingRewards.filter(isActiveStakingReward).map((sr) => sr.staking_denom),
    );

    const tradable = new Set<string>();
    for (const pool of sources.pools) {
        tradable.add(pool.base);
        tradable.add(pool.quote);
    }

    const volume = new Map<string, number>();
    for (const pool of sources.poolsData) {
        const usd = pool.usdVolume.toNumber();
        for (const denom of new Set([pool.base, pool.quote])) {
            volume.set(denom, (volume.get(denom) ?? 0) + usd);
        }
    }

    const marketCap = new Map<string, number>();
    for (const token of sources.tokens) {
        const {price} = tokenMarket(token.denom, sources.prices, new Map(), sources.quotes);
        if (price.gt(0)) {
            marketCap.set(token.denom, uAmountToBigNumberAmount(token.supply, token.decimals).multipliedBy(price).toNumber());
        }
    }

    return {holdersPool, rewardPrograms, tradable, marketCap, volume};
}
