import BigNumber from 'bignumber.js'
import { amountToUAmount } from '@bze/bze-ui-kit'
import { validateAmount } from '@/components/token-wizard/validation'

// Burning has no form in the Factory: everyone burns on the Burner app (BFE-271).

/** Why a mint amount can't be sent, or '' when it can. */
export function mintAmountError(amount: string, decimals: number): string {
    return validateAmount(amount, decimals)
}

/** The total supply after minting a valid display amount. */
export function newTotalSupply(current: BigNumber, amount: string): BigNumber {
    return current.plus(amount)
}

/** The `coins` field of MsgMint: base units glued to the denom. */
export function supplyCoins(amount: string, decimals: number, denom: string): string {
    return `${amountToUAmount(amount.trim(), decimals)}${denom}`
}

/** "12.5% of supply", or undefined when the supply is zero / unknown. */
export function shareOfSupply(part: BigNumber, whole: BigNumber): string | undefined {
    if (!whole.gt(0)) return undefined
    const pct = part.dividedBy(whole).multipliedBy(100)
    return `${pct.gt(0) && pct.lt(0.01) ? '<0.01' : pct.decimalPlaces(2).toString()}% of supply`
}
