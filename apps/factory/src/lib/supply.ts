import BigNumber from 'bignumber.js'
import { amountToUAmount } from '@bze/bze-ui-kit'
import { validateAmount } from '@/components/token-wizard/validation'

export type SupplyAction = 'mint' | 'burn'

export const BURN_OVER_BALANCE = 'You can only burn tokens you hold — the amount exceeds your balance.'

/**
 * Why a mint/burn amount can't be sent, or '' when it can. Burn is capped by the wallet's own
 * balance (base units): the tokenfactory only burns coins the admin holds.
 */
export function supplyAmountError(amount: string, decimals: number, action: SupplyAction, balance: BigNumber): string {
    const base = validateAmount(amount, decimals)
    if (base) return base
    if (action === 'burn' && balance.lt(amountToUAmount(amount, decimals))) return BURN_OVER_BALANCE
    return ''
}

/** The total supply after minting / burning a valid display amount. */
export function newTotalSupply(current: BigNumber, amount: string, action: SupplyAction): BigNumber {
    return action === 'mint' ? current.plus(amount) : current.minus(amount)
}

/** The `coins` field of MsgMint / MsgBurn: base units glued to the denom. */
export function supplyCoins(amount: string, decimals: number, denom: string): string {
    return `${amountToUAmount(amount.trim(), decimals)}${denom}`
}

/** "12.5% of supply", or undefined when the supply is zero / unknown. */
export function shareOfSupply(part: BigNumber, whole: BigNumber): string | undefined {
    if (!whole.gt(0)) return undefined
    const pct = part.dividedBy(whole).multipliedBy(100)
    return `${pct.gt(0) && pct.lt(0.01) ? '<0.01' : pct.decimalPlaces(2).toString()}% of supply`
}
