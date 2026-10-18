import BigNumber from 'bignumber.js'
import type { FeeSplit } from '@/components/pool-form/fee-split-slider'

// Chain range is 0.001–0.05; the UI speaks percent (0.1%–5%).
export const MIN_SWAP_FEE_PCT = 0.1
export const MAX_SWAP_FEE_PCT = 5
export const DEFAULT_SWAP_FEE_PCT = '0.2'
export const SWAP_FEE_PRESETS = ['0.1', '0.2', '0.3', '1']

/** Required, numeric, 0.1–5 %, at most 2 decimals. */
export function validateSwapFee(fee: string): string {
    const trimmed = fee.trim()
    if (!trimmed) return 'Swap fee is required.'
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return 'Enter a valid percentage.'
    const value = Number(trimmed)
    if (value < MIN_SWAP_FEE_PCT || value > MAX_SWAP_FEE_PCT) {
        return `Swap fee must be between ${MIN_SWAP_FEE_PCT}% and ${MAX_SWAP_FEE_PCT}%.`
    }
    if ((trimmed.split('.')[1]?.length ?? 0) > 2) {
        return 'At most 2 decimal places.'
    }
    return ''
}

/** The swap fee as the chain expects it: a fraction (0.2 % → "0.002"). */
export function swapFeeToChain(pct: string): string {
    return new BigNumber(pct).div(100).toString()
}

export interface ChainPair {
    base: string;
    quote: string;
    initialBase: string;
    initialQuote: string;
}

/**
 * The pair as the keeper stores it: denoms sorted alphabetically, the micro-amounts
 * swapped to match. Sending it pre-sorted makes what was reviewed exactly what lands
 * on chain.
 */
export function sortPairForChain(baseDenom: string, quoteDenom: string, baseUAmount: string, quoteUAmount: string): ChainPair {
    return baseDenom < quoteDenom
        ? { base: baseDenom, quote: quoteDenom, initialBase: baseUAmount, initialQuote: quoteUAmount }
        : { base: quoteDenom, quote: baseDenom, initialBase: quoteUAmount, initialQuote: baseUAmount }
}

/**
 * What a reserve's Max button may fill in (micro-units): the gas-aware max spendable,
 * minus the creation fee when the reserve is in the fee denom, floored at 0.
 */
export function maxReserveAmount(maxSpendable: BigNumber, denom: string, fee?: { denom: string; amount: string }): BigNumber {
    if (!fee || fee.denom !== denom) return maxSpendable
    const left = maxSpendable.minus(fee.amount)
    return left.gt(0) ? left : new BigNumber(0)
}

/** "<pct>% · providers <p>% · burner <b>% · treasury <t>%" */
export function swapFeeSummary(pct: string, split: FeeSplit): string {
    return `${pct.trim()}% · providers ${split.providers}% · burner ${split.burner}% · treasury ${split.treasury}%`
}
