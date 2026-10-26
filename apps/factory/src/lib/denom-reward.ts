import BigNumber from 'bignumber.js'
import type { DenomRewardPrize, DenomRewardSchedule, FeeCoin } from '@bze/bze-ui-kit'
import { minMaxHint } from '@/lib/format'

/**
 * Pure Denom Rewards math for the factory forms (chain v8.2.0, x/rewards). The chain rules it
 * mirrors live in the Denom Rewards Business Logic page; the keeper is the final word.
 */

/** Deep link to the schedule form: add a schedule to the DR of `denom`, or extend `scheduleId`. */
export const scheduleFormHref = (denom: string, scheduleId?: string) =>
    `/denom-reward/schedule?denom=${encodeURIComponent(denom)}` +
    (scheduleId ? `&schedule=${encodeURIComponent(scheduleId)}` : '')

// x/rewards HundredYearsInDays: a schedule runs 1…36,500 days, also after any extension.
export const MIN_SCHEDULE_DAYS = 1
export const MAX_SCHEDULE_DAYS = 36500

/**
 * Validates a days input. Create mode (`currentDuration` undefined): the schedule's duration,
 * 1…36,500. Extend mode: the EXTRA days, at least 1, and the new total may not pass 36,500.
 */
export function validateScheduleDays(value: string, currentDuration?: number): string {
    const trimmed = value.trim()
    if (!trimmed) return 'Required.'
    if (!/^\d+$/.test(trimmed)) return 'Enter a whole number of days.'
    const days = Number(trimmed)

    if (currentDuration === undefined) {
        if (days < MIN_SCHEDULE_DAYS || days > MAX_SCHEDULE_DAYS) {
            return `${minMaxHint(MIN_SCHEDULE_DAYS, MAX_SCHEDULE_DAYS, 'days')}.`
        }
        return ''
    }

    const room = Math.max(0, MAX_SCHEDULE_DAYS - currentDuration)
    if (room === 0) return `Max ${MAX_SCHEDULE_DAYS} days reached.`
    if (days < 1) return 'Enter a whole number of days.'
    if (days > room) return `Max ${room} days.`
    return ''
}

/** Days the schedule still has to pay. A day without stakers is skipped and stays in this count. */
export function scheduleDaysLeft(schedule: Pick<DenomRewardSchedule, 'duration' | 'payouts'>): number {
    return Math.max(0, schedule.duration - schedule.payouts)
}

export interface PrizeSlot {
    /** The prize denom was never used on this DR → the prize-creation fee applies and it takes a slot. */
    isNewPrize: boolean;
    /** A new prize denom no longer fits under `max_prize_denoms_per_dr` (the chain refuses with 5017). */
    capReached: boolean;
    /** Distinct prize denoms the DR has used so far (finished schedules keep their entry). */
    used: number;
}

/** Where `prizeDenom` stands against the DR's prize entries and the cap (`max` undefined = unknown, no warning). */
export function prizeSlot(prizes: ReadonlyArray<Pick<DenomRewardPrize, 'prize_denom'>>, prizeDenom: string, max?: number): PrizeSlot {
    const isNewPrize = !prizes.some(p => p.prize_denom === prizeDenom)
    return {
        isNewPrize,
        capReached: isNewPrize && max !== undefined && prizes.length >= max,
        used: prizes.length,
    }
}

export interface ScheduleCostInput {
    /** Daily prize in base units; undefined while the input is invalid. */
    dailyUAmount?: BigNumber | string;
    /** Days to fund (create: the duration; extend: the extra days); undefined while invalid. */
    days?: number;
    prizeDenom: string;
    /** 'create' pays the schedule fee (+ the prize fee for a new prize denom); 'extend' pays no fee. */
    mode: 'create' | 'extend';
    scheduleFee?: FeeCoin;
    prizeFee?: FeeCoin;
    isNewPrize?: boolean;
}

export interface ScheduleCostSummary {
    /** daily × days of the prize denom, escrowed in full by the tx; undefined while inputs are invalid. */
    escrow?: FeeCoin;
    /** Every fee the tx charges, named, in charging order. */
    fees: { label: string; coin: FeeCoin }[];
    /** The fees merged per denom — what is disclosed as one total and resolved against the fee token. */
    feeTotals: FeeCoin[];
    /** False when a fee that applies could not be read from the chain — never treat that as free. */
    feesKnown: boolean;
}

const sumByDenom = (coins: FeeCoin[]): FeeCoin[] => {
    const totals = new Map<string, BigNumber>()
    coins.forEach(c => totals.set(c.denom, (totals.get(c.denom) ?? new BigNumber(0)).plus(c.amount)))
    return Array.from(totals, ([denom, amount]) => ({ denom, amount: amount.toFixed(0) }))
}

/** What a create/extend schedule tx takes from the wallet, before gas. */
export function summarizeScheduleCosts(input: ScheduleCostInput): ScheduleCostSummary {
    const { dailyUAmount, days, prizeDenom, mode, scheduleFee, prizeFee, isNewPrize } = input

    let escrow: FeeCoin | undefined
    if (dailyUAmount !== undefined && days !== undefined && days > 0) {
        const amount = new BigNumber(dailyUAmount).multipliedBy(days)
        if (amount.isFinite() && amount.gt(0)) {
            escrow = { denom: prizeDenom, amount: amount.toFixed(0) }
        }
    }

    const fees: { label: string; coin: FeeCoin }[] = []
    let feesKnown = true
    if (mode === 'create') {
        if (scheduleFee) {
            fees.push({ label: 'Schedule fee', coin: scheduleFee })
        } else {
            feesKnown = false
        }
        if (isNewPrize) {
            if (prizeFee) {
                fees.push({ label: 'New prize token fee', coin: prizeFee })
            } else {
                feesKnown = false
            }
        }
    }

    // A zero fee param makes the charge free on chain; keep it named but don't count it.
    const charged = fees.map(f => f.coin).filter(c => new BigNumber(c.amount).gt(0))

    return { escrow, fees, feeTotals: sumByDenom(charged), feesKnown }
}

/** The Compounded reward wizard, with the token to make stakable when known. */
export const compoundedNewHref = (denom?: string) =>
    denom ? `/denom-reward/new?denom=${encodeURIComponent(denom)}` : '/denom-reward/new'

/**
 * The compounded reward of any token, for any wallet: its card in the rewards directory, which
 * prefills the search with the token and scrolls to it (BFE-272; `/denom-reward/token` redirects here).
 */
export const denomRewardHref = (denom: string) => `/rewards?denom=${encodeURIComponent(denom)}`

export interface AirdropCostInput {
    /** Airdrop amount in prize base units; undefined while the input is invalid. */
    uAmount?: BigNumber | string;
    prizeDenom: string;
    prizeFee?: FeeCoin;
    isNewPrize?: boolean;
}

/** What an airdrop takes from the wallet, before gas: the amount itself plus, for a prize denom new to the DR, the prize fee. */
export function summarizeAirdropCosts(input: AirdropCostInput): ScheduleCostSummary {
    const { uAmount, prizeDenom, prizeFee, isNewPrize } = input

    let escrow: FeeCoin | undefined
    if (uAmount !== undefined && prizeDenom) {
        const amount = new BigNumber(uAmount)
        if (amount.isFinite() && amount.gt(0)) {
            escrow = { denom: prizeDenom, amount: amount.integerValue(BigNumber.ROUND_DOWN).toFixed(0) }
        }
    }

    const fees: { label: string; coin: FeeCoin }[] = []
    let feesKnown = true
    if (isNewPrize) {
        if (prizeFee) {
            fees.push({ label: 'New prize token fee', coin: prizeFee })
        } else {
            feesKnown = false
        }
    }
    const charged = fees.map(f => f.coin).filter(c => new BigNumber(c.amount).gt(0))

    return { escrow, fees, feeTotals: sumByDenom(charged), feesKnown }
}

export interface AirdropGuardInput {
    /** The DR's live staked total (base units). */
    stakedAmount: string;
    prizeDenom: string;
    slot: PrizeSlot;
    feesKnown: boolean;
    /** `max_prize_denoms_per_dr`, for the cap blocker; undefined while unknown. */
    max?: number;
}

/** The prize-cap blocker (5017): "Max 5 reward tokens reached." */
export const prizeCapText = (max?: number) => max === undefined ? 'Max reward tokens reached.' : `Max ${max} reward tokens reached.`

/** The nobody-stakes blocker (5018): "Nobody stakes HONEY yet." */
export const nothingStakedText = (ticker: string) => `Nobody stakes ${ticker} yet.`

/**
 * Why an airdrop can't be sent as configured, or '' when nothing blocks it. Mirrors the chain's
 * refusals (5018 no stakers, 5017 prize cap) — a convenience only, the chain stays the gate.
 */
export function airdropBlocker({ stakedAmount, prizeDenom, slot, feesKnown, max, stakedTicker }: AirdropGuardInput & { stakedTicker?: string }): string {
    if (!new BigNumber(stakedAmount || 0).gt(0)) return nothingStakedText(stakedTicker || 'this token')
    return prizeBlocker({ prizeDenom, slot, feesKnown, max })
}

/**
 * Why the chain would refuse this prize token on a compounded reward, or '': the cap is reached, or the
 * new prize fee is unknown. The part of `airdropBlocker` that a daily prize shares.
 */
export function prizeBlocker({ prizeDenom, slot, feesKnown, max }: Omit<AirdropGuardInput, 'stakedAmount'>): string {
    if (!prizeDenom) return ''
    if (slot.capReached) return prizeCapText(max)
    if (slot.isNewPrize && !feesKnown) {
        return "The new prize token fee couldn't be read from the chain. Try again later."
    }
    return ''
}
