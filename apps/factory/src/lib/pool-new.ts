import BigNumber from 'bignumber.js'
import type { Asset } from '@bze/bze-ui-kit'
import { type FeeSplit, feeSplitToFeeDest } from '@/components/pool-form/fee-split-slider'
import { haltedPairError } from '@/lib/halted'

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

/** "0.2 % · 50 % to providers, 25 % burned, 25 % treasury"; the shares at 0 % are left out. */
export function swapFeeSummary(pct: string, split: FeeSplit): string {
    const shares = [
        split.providers > 0 ? `${split.providers} % to providers` : '',
        split.burner > 0 ? `${split.burner} % burned` : '',
        split.treasury > 0 ? `${split.treasury} % treasury` : '',
    ].filter(Boolean)
    return `${pct.trim()} % · ${shares.join(', ')}`
}

/** Why the two picked tokens can't get a new pool; `existingPoolId` when the pool is already there. */
export interface PairProblem {
    message: string;
    existingPoolId?: string;
}

/**
 * The pair checks of step 1: two different tokens, neither halted, and no pool for the pair yet
 * (`findPool` looks it up in either order). Undefined while a side is missing, or when the pair is fine.
 */
export function pairProblem(
    baseDenom: string,
    quoteDenom: string,
    baseAsset: Asset | undefined,
    quoteAsset: Asset | undefined,
    findPool: (a: string, b: string) => { id: string } | undefined,
): PairProblem | undefined {
    if (!baseDenom || !quoteDenom) return undefined
    if (baseDenom === quoteDenom) return { message: 'Pick two different tokens.' }
    const halted = haltedPairError(baseAsset, quoteAsset)
    if (halted !== '') return { message: halted }
    const existing = findPool(baseDenom, quoteDenom)
    if (existing) {
        return { message: 'This pair already has a pool. Each pair gets exactly one.', existingPoolId: existing.id }
    }
    return undefined
}

/** Quote per base from the two starting amounts (display units); undefined unless both are positive numbers. */
export function startingPrice(baseAmount: string, quoteAmount: string): BigNumber | undefined {
    const base = new BigNumber(baseAmount.trim())
    const quote = new BigNumber(quoteAmount.trim())
    if (!base.isFinite() || !quote.isFinite() || !base.gt(0) || !quote.gt(0)) return undefined
    return quote.div(base)
}

/** The MsgCreateLiquidityPool fields, from the answers in micro-units: pair sorted, swap fee as a fraction, `stable: false`. */
export function createPoolMsgValue(input: {
    creator: string;
    baseDenom: string;
    quoteDenom: string;
    baseUAmount: string;
    quoteUAmount: string;
    swapFeePct: string;
    split: FeeSplit;
}) {
    return {
        creator: input.creator,
        ...sortPairForChain(input.baseDenom, input.quoteDenom, input.baseUAmount, input.quoteUAmount),
        fee: swapFeeToChain(input.swapFeePct),
        feeDest: feeSplitToFeeDest(input.split),
        stable: false,
    }
}
