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
