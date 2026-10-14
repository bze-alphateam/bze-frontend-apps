import BigNumber from 'bignumber.js'
import type { DenomRewardPrize, DenomRewardSchedule, FeeCoin } from '@bze/bze-ui-kit'

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
            return `Must be between ${MIN_SCHEDULE_DAYS} and ${MAX_SCHEDULE_DAYS.toLocaleString('en-US')} days.`
        }
        return ''
    }

    const room = Math.max(0, MAX_SCHEDULE_DAYS - currentDuration)
    if (room === 0) {
        return `This schedule already runs the maximum of ${MAX_SCHEDULE_DAYS.toLocaleString('en-US')} days.`
    }
    if (days < 1 || days > room) {
        return `Add between 1 and ${room.toLocaleString('en-US')} days — a schedule can't run longer than ${MAX_SCHEDULE_DAYS.toLocaleString('en-US')} days in total.`
    }
    return ''
}

/** Days the schedule still has to pay. A day without stakers is skipped and stays in this count. */
export function scheduleDaysLeft(schedule: Pick<DenomRewardSchedule, 'duration' | 'payouts'>): number {
    return Math.max(0, schedule.duration - schedule.payouts)
}

/** Escrow still held for the schedule: daily × (duration − payouts), prize base units. */
export function scheduleRemainingBudget(schedule: Pick<DenomRewardSchedule, 'daily_amount' | 'duration' | 'payouts'>): BigNumber {
    return new BigNumber(schedule.daily_amount).multipliedBy(scheduleDaysLeft(schedule))
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

/** Deep link to the airdrop form of the DR of `denom`. */
export const airdropFormHref = (denom: string) => `/denom-reward/airdrop?denom=${encodeURIComponent(denom)}`

/**
 * The public denom reward page of a token: the DR card for any wallet and any token. The manage
 * token page only opens a wallet's own factory tokens, so the directory and the forms link here.
 */
export const denomRewardHref = (denom: string) => `/denom-reward/token?denom=${encodeURIComponent(denom)}`

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
}

/**
 * Why an airdrop can't be sent as configured, or '' when nothing blocks it. Mirrors the chain's
 * refusals (5018 no stakers, 5017 prize cap) — a convenience only, the chain stays the gate.
 */
export function airdropBlocker({ stakedAmount, prizeDenom, slot, feesKnown }: AirdropGuardInput): string {
    if (!new BigNumber(stakedAmount || 0).gt(0)) {
        return 'Nobody is staking this token yet, so there is no one to pay. The chain refuses an airdrop into a denom reward without stakers — nothing would leave your wallet.'
    }
    if (!prizeDenom) return ''
    if (slot.capReached) {
        return 'This denom reward already uses the maximum number of prize tokens. Pick a prize token it already pays.'
    }
    if (slot.isNewPrize && !feesKnown) {
        return "The new prize token fee couldn't be read from the chain. Try again later."
    }
    return ''
}

/**
 * "Last paid" of a prize entry from its `last_distribution_epoch` (day-epoch count, 0 = never paid)
 * and the chain's current day-epoch count. Without the current count the raw epoch is shown.
 */
export function formatLastPaid(lastDistributionEpoch: string | number, currentDayEpoch?: string | number): string {
    const last = Number(lastDistributionEpoch)
    if (!Number.isFinite(last) || last <= 0) return 'Never'

    const current = currentDayEpoch === undefined ? NaN : Number(currentDayEpoch)
    if (!Number.isFinite(current) || current <= 0) return `Day ${last.toLocaleString('en-US')}`

    const ago = Math.max(0, current - last)
    if (ago === 0) return 'Today'
    if (ago === 1) return 'Yesterday'
    return `${ago.toLocaleString('en-US')} days ago`
}
