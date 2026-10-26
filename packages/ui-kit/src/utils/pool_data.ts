import BigNumber from "bignumber.js";
import type {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";
import type {Asset} from "../types/asset";
import type {LiquidityPoolData} from "../types/liquidity_pool";
import type {MarketData} from "../types/market";
import {toBigNumber, uAmountToAmount} from "./amount";
import {createMarketId} from "./market";
import {calculateRewardsStakingApr} from "./staking";

/**
 * The aggregator tickers of liquidity pools, by pool id. The tickers endpoint returns order-book
 * markets and pools together; an order-book market's id is `createMarketId(base, quote)`, a
 * pool's is the pool id, so every ticker whose id differs from the order-book id is a pool.
 */
export function poolTickers(tickers: MarketData[]): Map<string, MarketData> {
    const byPool = new Map<string, MarketData>();
    tickers.forEach((ticker) => {
        if (createMarketId(ticker.base, ticker.quote) === ticker.market_id) return;
        byPool.set(ticker.market_id, ticker);
    });

    return byPool;
}

/**
 * USD value, 24h volume, fees and APR of a pool: volume and fees are read from the base side and
 * fall back to the quote side when the base has no USD price; the APR is the
 * providers' share of a day's fees over the pool's USD value. Without a ticker the volumes, fees
 * and APR are 0.
 */
export function poolData(
    pool: LiquidityPoolSDKType,
    prices: Map<string, BigNumber>,
    baseAsset?: Asset,
    quoteAsset?: Asset,
    ticker?: MarketData,
): LiquidityPoolData {
    const basePrice = prices.get(pool.base) || toBigNumber(0);
    const quotePrice = prices.get(pool.quote) || toBigNumber(0);
    const usdValue = basePrice.multipliedBy(uAmountToAmount(pool.reserve_base, baseAsset?.decimals || 0))
        .plus(quotePrice.multipliedBy(uAmountToAmount(pool.reserve_quote, quoteAsset?.decimals || 0)));

    const baseVolume = toBigNumber(ticker?.base_volume || 0);
    const quoteVolume = toBigNumber(ticker?.quote_volume || 0);
    // gt(0), not isPositive(): BigNumber(0).isPositive() is true, which would never fall back.
    let usdVolume = basePrice.multipliedBy(baseVolume);
    if (!usdVolume.gt(0)) {
        usdVolume = quotePrice.multipliedBy(quoteVolume);
    }

    let usdFees = baseVolume.multipliedBy(pool.fee).multipliedBy(basePrice);
    if (!usdFees.gt(0)) {
        usdFees = quoteVolume.multipliedBy(pool.fee).multipliedBy(quotePrice);
    }

    // The providers' cut of a day's fees (USD), annualised over the pool's USD value. Dividing the
    // fees by the volume first would yield the fee rate instead of USD and a near-zero APR.
    const feeToLp = usdFees.multipliedBy(pool.fee_dest?.providers || 0);
    let apr = calculateRewardsStakingApr(feeToLp, usdValue);
    if (!apr.isFinite()) apr = toBigNumber(0);

    return {
        poolId: pool.id,
        base: pool.base,
        quote: pool.quote,
        usdValue,
        usdVolume,
        baseVolume,
        quoteVolume,
        isComplete: basePrice.gt(0) && quotePrice.gt(0),
        apr: apr.toFixed(2),
        usdFees,
    };
}
