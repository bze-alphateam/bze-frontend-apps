import { prettyAmount, uAmountToBigNumberAmount } from '@bze/bze-ui-kit'
import type { LiquidityPoolSDKType } from '@bze/bzejs/bze/tradebin/store'

// Pure wording and filters of the token page's groups (BFE-271).

interface Side {
    ticker: string;
    decimals: number;
}

/**
 * A pool row's line, from the page token's side: "1 TOK = 0.0021 BZE · 400 TOK + 812 BZE in the pool".
 * An empty pool has no price.
 */
export function poolLine(
    pool: Pick<LiquidityPoolSDKType, 'base' | 'quote' | 'reserve_base' | 'reserve_quote'>,
    denom: string,
    base: Side,
    quote: Side,
): string {
    const reserveBase = uAmountToBigNumberAmount(pool.reserve_base, base.decimals)
    const reserveQuote = uAmountToBigNumberAmount(pool.reserve_quote, quote.decimals)
    const liquidity = `${prettyAmount(reserveBase)} ${base.ticker} + ${prettyAmount(reserveQuote)} ${quote.ticker} in the pool`
    if (!reserveBase.gt(0) || !reserveQuote.gt(0)) return liquidity

    const tokenIsBase = pool.base === denom
    const [mine, other, mineReserve, otherReserve] = tokenIsBase
        ? [base, quote, reserveBase, reserveQuote]
        : [quote, base, reserveQuote, reserveBase]
    return `1 ${mine.ticker} = ${prettyAmount(otherReserve.dividedBy(mineReserve))} ${other.ticker} · ${liquidity}`
}

/**
 * The simple rewards a token page lists: those that stake the token itself or LP shares of a pool
 * with it on either side. Rewards that only pay out in the token are left out.
 */
export function stakesToken(
    reward: { staking_denom: string },
    denom: string,
    pools: ReadonlyArray<Pick<LiquidityPoolSDKType, 'base' | 'quote' | 'lp_denom'>>,
): boolean {
    if (reward.staking_denom === denom) return true
    return pools.some(p => p.lp_denom === reward.staking_denom && (p.base === denom || p.quote === denom))
}
