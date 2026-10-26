import BigNumber from 'bignumber.js'
import { amountToUAmount } from '@bze/bze-ui-kit'
import { validateAmount } from '@/components/token-wizard/validation'
import { minMaxHint } from '@/lib/format'

// Chain limits verified in x/rewards: duration 1–36,500 days, lock 0–3,650 days.
export const MIN_DURATION_DAYS = 1
export const MAX_DURATION_DAYS = 36500
export const MAX_LOCK_DAYS = 3650

/** Required whole number of days within [min, max]. */
export function validateDays(value: string, min: number, max: number): string {
    const trimmed = value.trim()
    if (!trimmed) return 'Required.'
    if (!/^\d+$/.test(trimmed)) return 'Enter a whole number of days.'
    const days = Number(trimmed)
    if (days < min || days > max) {
        return `${minMaxHint(min, max, 'days')}.`
    }
    return ''
}

/** Empty or "0" = no minimum. */
export const hasNoMinStake = (value: string) => {
    const trimmed = value.trim()
    return !trimmed || trimmed === '0'
}

/** Min stake is optional: empty or 0 = no minimum, else a valid amount in the staking decimals. */
export function validateMinStake(value: string, decimals: number): string {
    if (hasNoMinStake(value)) return ''
    return validateAmount(value.trim(), decimals)
}

/** The min stake as the chain expects it: '0' for none, else base units. */
export function minStakeToChain(value: string, decimals: number): string {
    return hasNoMinStake(value) ? '0' : amountToUAmount(value.trim(), decimals)
}

/** What the chain escrows upfront: prize per day × duration, in base units. */
export function escrowAmount(prizePerDay: string, decimals: number, duration: string): BigNumber {
    return new BigNumber(amountToUAmount(prizePerDay, decimals)).multipliedBy(duration.trim())
}

export interface ProgramBalanceInput {
    /** Prize × days in base units; undefined while the inputs are invalid. */
    escrow?: BigNumber;
    prizeDenom: string;
    prizeBalance: BigNumber;
    fee?: { denom: string; amount: string };
    feeBalance: BigNumber;
    gasFee: { denom: string; amount: BigNumber };
    /** The fee is paid in the alternate token picked in Settings. */
    paysWithAlt: boolean;
}

/**
 * The escrow and the creation fee both leave the wallet at creation. When the prize IS
 * the fee denom, the balance must cover them together; when the fee is paid in the
 * Settings fee token instead, it never touches the prize balance.
 */
export function programBalances({ escrow, prizeDenom, prizeBalance, fee, feeBalance, gasFee, paysWithAlt }: ProgramBalanceInput) {
    let hasEnoughForEscrow = false
    if (escrow) {
        let needed = escrow
        if (fee && prizeDenom === fee.denom && !paysWithAlt) needed = needed.plus(fee.amount)
        hasEnoughForEscrow = prizeBalance.gte(needed)
    }

    let hasEnoughForFee = false
    if (fee) {
        let needed = new BigNumber(fee.amount)
        if (escrow && prizeDenom === fee.denom) needed = needed.plus(escrow)
        // The gas fee is deducted first, from the same balance when it is paid in the fee denom.
        if (gasFee.denom === fee.denom) needed = needed.plus(gasFee.amount)
        hasEnoughForFee = feeBalance.gte(needed)
    }

    return { hasEnoughForEscrow, hasEnoughForFee, canPayFee: hasEnoughForFee || paysWithAlt }
}

/**
 * The keeper emits a typed StakingRewardCreateEvent carrying the assigned id.
 * Typed-event attribute values are JSON-encoded, hence the quote stripping.
 */
export function extractRewardId(res: { [key: string]: unknown }): string | undefined {
    const events = res.events as
        | { type: string; attributes: { key: string; value: string }[] }[]
        | undefined
    const event = events?.find(e => e.type === 'bze.rewards.StakingRewardCreateEvent')
    const raw = event?.attributes.find(a => a.key === 'reward_id')?.value
    return raw ? raw.replace(/^"|"$/g, '') : undefined
}

/** Quick answers under "Days". */
export const DURATION_PRESETS = ['7', '30', '90', '180'] as const

const days = (n: number | string) => `${Number(n).toLocaleString('en-US')} day${Number(n) === 1 ? '' : 's'}`

/** "100 HONEY/day × 30 days": the budget step's summary and the announcement number. */
export const prizeSummary = (perDay: string, ticker: string, duration: string) =>
    `${perDay} ${ticker}/day × ${days(duration.trim())}`

/** The rules step's summary: "No lock · no minimum", "7-day lock · min 100 TOK". */
export function rulesSummary(lock: string, minStake?: string): string {
    const n = Number(lock.trim() || '0')
    const lockText = n > 0 ? `${n.toLocaleString('en-US')}-day lock` : 'No lock'
    return `${lockText} · ${minStake ? `min ${minStake}` : 'no minimum'}`
}

/** The REST shape of a tx's events (SDK 0.50 `tx_response.events`). */
type TxEvents = { events?: { type: string; attributes: { key: string; value: string }[] }[] }

/**
 * The id of the reward a confirmed tx created, read back from the chain's REST: the wizard's
 * transaction hook keeps only the hash, and the id exists only in the tx's event. Undefined when
 * the node doesn't know the tx (yet) or can't be reached.
 */
export async function fetchRewardId(
    restUrl: string,
    hash: string,
    fetchFn: (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }> = (url) => fetch(url),
): Promise<string | undefined> {
    try {
        const res = await fetchFn(`${restUrl.replace(/\/+$/, '')}/cosmos/tx/v1beta1/txs/${encodeURIComponent(hash)}`)
        if (!res.ok) return undefined
        const body = await res.json() as { tx_response?: TxEvents }
        return extractRewardId({ events: body.tx_response?.events })
    } catch {
        return undefined
    }
}
