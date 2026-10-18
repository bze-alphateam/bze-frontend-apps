import BigNumber from "bignumber.js";
import {bze} from "@bze/bzejs";
import type {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";
import {calculatePoolOppositeAmount, type LiquidityPoolData} from "@bze/bze-ui-kit";

import {tokenPools} from "./chart";
import {minimumOutput} from "./swap";

const {addLiquidity, removeLiquidity} = bze.tradebin.MessageComposer.withTypeUrl;

/** What the Remove form offers, in percent of the viewer's LP shares. */
export const REMOVE_PERCENTAGES = [25, 50, 75, 100] as const;

/** One row of "Liquidity pools": a pool T sits in, with its other token and its numbers. */
export interface TokenPoolRow {
    pool: LiquidityPoolSDKType;
    /** The pool's other token (not T). */
    other: string;
    /** T is the pool's base, so T's amount is the pool's base amount. */
    tokenIsBase: boolean;
    /** USD value of both reserves, when both tokens have a price. */
    liquidityUsd?: BigNumber;
    /** 24h volume in USD, when the pool has liquidity data. */
    volumeUsd?: BigNumber;
    /** Providers' APR in percent, only with volume (Business Logic R9). */
    apr?: BigNumber;
}

/**
 * The pools containing T (R9), the most USD liquidity first. Liquidity shows only when both
 * tokens are priced, so a half-priced pool isn't understated; the APR only when the pool traded in
 * the last 24h and the APR is a positive number.
 */
export function tokenPoolRows(denom: string, pools: LiquidityPoolSDKType[], data: Map<string, LiquidityPoolData>): TokenPoolRow[] {
    return tokenPools(denom, pools, (id) => data.get(id)?.usdValue).map((pool) => {
        const stats = data.get(pool.id);
        const apr = stats ? new BigNumber(stats.apr) : undefined;
        const tokenIsBase = pool.base === denom;

        return {
            pool,
            other: tokenIsBase ? pool.quote : pool.base,
            tokenIsBase,
            liquidityUsd: stats?.isComplete ? stats.usdValue : undefined,
            volumeUsd: stats?.usdVolume,
            apr: stats && stats.usdVolume.gt(0) && apr?.isFinite() && apr.gt(0) ? apr : undefined,
        };
    });
}

/**
 * The other side of a deposit at the pool's ratio, in display units, from `amount` (display
 * units) of one side. Rounded down to the other token's decimals; 0 for an empty pool.
 */
export function matchedAmount(
    pool: LiquidityPoolSDKType,
    amount: string,
    fromBase: boolean,
    fromDecimals: number,
    toDecimals: number,
): BigNumber {
    const value = new BigNumber(amount);
    if (value.isNaN() || !value.gt(0)) return new BigNumber(0);

    const uAmount = value.shiftedBy(fromDecimals).integerValue(BigNumber.ROUND_FLOOR);
    return calculatePoolOppositeAmount(pool, uAmount, fromBase)
        .integerValue(BigNumber.ROUND_FLOOR)
        .shiftedBy(-toDecimals);
}

/**
 * The LP shares a deposit mints (base units), as the chain does: the smaller of the two deposit
 * ratios times the LP supply, rounded down. 0 when the pool or the deposit is empty.
 */
export function depositShares(pool: LiquidityPoolSDKType, totalShares: BigNumber.Value, uBase: BigNumber, uQuote: BigNumber): BigNumber {
    const reserveBase = new BigNumber(pool.reserve_base);
    const reserveQuote = new BigNumber(pool.reserve_quote);
    const total = new BigNumber(totalShares);
    if (!reserveBase.gt(0) || !reserveQuote.gt(0) || !total.gt(0) || !uBase.gt(0) || !uQuote.gt(0)) return new BigNumber(0);

    const ratio = BigNumber.minimum(uBase.dividedBy(reserveBase), uQuote.dividedBy(reserveQuote));
    return ratio.multipliedBy(total).integerValue(BigNumber.ROUND_FLOOR);
}

/** The viewer's share of the pool in percent once `shares` are minted on top of `totalShares`. */
export function shareAfterDeposit(shares: BigNumber, totalShares: BigNumber.Value): BigNumber {
    const total = new BigNumber(totalShares).plus(shares);
    if (!total.gt(0)) return new BigNumber(0);

    return shares.dividedBy(total).multipliedBy(100);
}

/** The viewer's share of the pool in percent, or undefined without shares. */
export function poolShareOf(userShares: BigNumber, totalShares: BigNumber.Value): BigNumber | undefined {
    const total = new BigNumber(totalShares);
    if (!userShares.gt(0) || !total.gt(0)) return undefined;

    return userShares.dividedBy(total).multipliedBy(100);
}

/**
 * Why `amount` (display units) can't be deposited, or '' when it can as far as the balance goes.
 * `balance` is in display units.
 */
export function depositAmountProblem(amount: string, balance: BigNumber, decimals: number, ticker: string): string {
    const value = new BigNumber(amount);
    if (value.isNaN() || !value.gt(0)) return `Enter an amount of ${ticker} above 0`;
    if ((value.decimalPlaces() ?? 0) > decimals) return `Use at most ${decimals} decimals for ${ticker}`;
    if (value.gt(balance)) return `Insufficient ${ticker} balance`;

    return "";
}

/** What removing `percent` of the viewer's shares returns (base units), before slippage. */
export interface RemoveEstimate {
    lpTokens: BigNumber;
    base: BigNumber;
    quote: BigNumber;
}

/**
 * The LP shares `percent` of the viewer's holding is (all of them at 100%, rounded down below) and
 * the reserves they return, rounded down as the chain does.
 */
export function removeEstimate(pool: LiquidityPoolSDKType, userShares: BigNumber, totalShares: BigNumber.Value, percent: number): RemoveEstimate {
    const total = new BigNumber(totalShares);
    const lpTokens = percent >= 100
        ? userShares.integerValue(BigNumber.ROUND_FLOOR)
        : userShares.multipliedBy(percent).dividedBy(100).integerValue(BigNumber.ROUND_FLOOR);
    if (!total.gt(0) || !lpTokens.gt(0)) return {lpTokens: new BigNumber(0), base: new BigNumber(0), quote: new BigNumber(0)};

    const share = lpTokens.dividedBy(total);
    return {
        lpTokens,
        base: new BigNumber(pool.reserve_base).multipliedBy(share).integerValue(BigNumber.ROUND_FLOOR),
        quote: new BigNumber(pool.reserve_quote).multipliedBy(share).integerValue(BigNumber.ROUND_FLOOR),
    };
}

/** The deposit message: amounts and the minimum LP shares (expected minus slippage) in base units. */
export function addLiquidityMessage(creator: string, poolId: string, uBase: BigNumber, uQuote: BigNumber, shares: BigNumber, slippage: number) {
    return addLiquidity({
        creator,
        poolId,
        baseAmount: uBase.toFixed(0),
        quoteAmount: uQuote.toFixed(0),
        minLpTokens: minimumOutput(shares, slippage).toFixed(0),
    });
}

/** The withdrawal message: the LP shares and the least of each reserve accepted after slippage. */
export function removeLiquidityMessage(creator: string, poolId: string, estimate: RemoveEstimate, slippage: number) {
    return removeLiquidity({
        creator,
        poolId,
        lpTokens: estimate.lpTokens.toFixed(0),
        minBase: minimumOutput(estimate.base, slippage).toFixed(0),
        minQuote: minimumOutput(estimate.quote, slippage).toFixed(0),
    });
}
