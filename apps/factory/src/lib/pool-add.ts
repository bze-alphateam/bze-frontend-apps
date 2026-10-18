import BigNumber from 'bignumber.js'
import { amountToUAmount, calculatePoolOppositeAmount, uAmountToBigNumberAmount } from '@bze/bze-ui-kit'
import type { LiquidityPoolSDKType } from '@bze/bzejs/bze/tradebin/store'
import { validateAmount } from '@/components/token-wizard/validation'

export const SLIPPAGE_PRESETS = ['0.5', '1', '3']
export const DEFAULT_SLIPPAGE_PCT = '1'

/**
 * The other side of a deposit (display units), from the pool's current reserves.
 * Rounded up in micro-units so the pair never lands short of the pool ratio;
 * '' while the typed amount is invalid or would need nothing on the other side.
 */
export function oppositeDeposit(
    pool: Pick<LiquidityPoolSDKType, 'reserve_base' | 'reserve_quote'>,
    value: string,
    editedIsBase: boolean,
    editedDecimals: number,
    oppositeDecimals: number,
): string {
    if (validateAmount(value, editedDecimals) !== '') return ''
    const oppositeU = calculatePoolOppositeAmount(
        pool as LiquidityPoolSDKType,
        amountToUAmount(value, editedDecimals),
        editedIsBase,
    ).integerValue(BigNumber.ROUND_CEIL)
    if (oppositeU.isZero()) return ''
    return uAmountToBigNumberAmount(oppositeU, oppositeDecimals).toFixed()
}

/**
 * The guard the chain enforces: fewer LP tokens than this and the deposit is refused.
 * floor(expected × (100 − slippage) / 100), never below 1; 0 when nothing is expected.
 */
export function minLpTokens(expected: BigNumber, slippagePct: string): BigNumber {
    if (!expected.gt(0)) return new BigNumber(0)
    const guarded = expected
        .multipliedBy(new BigNumber(100).minus(slippagePct).div(100))
        .integerValue(BigNumber.ROUND_DOWN)
    return BigNumber.maximum(guarded, 1)
}

/** The wallet's share of the pool (%) once the deposit lands; undefined without one. */
export function shareAfterDeposit(expected: BigNumber, userShares: BigNumber, totalShares: BigNumber): BigNumber | undefined {
    if (!expected.gt(0)) return undefined
    const newTotal = totalShares.plus(expected)
    return userShares.plus(expected).dividedBy(newTotal).multipliedBy(100)
}
