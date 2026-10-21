import BigNumber from 'bignumber.js'
import type { DenomReward, DenomRewardSchedule } from '@bze/bze-ui-kit'
import { type PrizeSlot, MAX_SCHEDULE_DAYS, scheduleDaysLeft, validateScheduleDays } from '@/lib/denom-reward'
import { addDays, formatDay } from '@/lib/reward-extend'

// The daily prize (add + extend) and Airdrop to stakers wizards (BFE-268): the picker row states,
// the new-prize note, the extend math and the Done titles. Both fund any token's compounded reward.

export type PrizeFlow = 'dailyPrize' | 'airdrop'

/** A picker row's state: what the compounded reward stakes. `disabled` rows can't be picked. */
export interface StakedRowState {
    text: string;
    tone: 'good' | 'muted' | 'warn';
    disabled?: boolean;
}

/**
 * The right side of a picker row: "<staked> staked". With nothing staked a daily prize still works
 * (days without stakers are skipped), but the chain refuses an airdrop (5018): the row is amber and
 * can't be picked.
 */
export function stakedRowState(stakedDisplay: BigNumber | undefined, flow: PrizeFlow, pretty: (n: BigNumber) => string): StakedRowState | undefined {
    if (stakedDisplay === undefined) return undefined
    if (stakedDisplay.gt(0)) return { text: `${pretty(stakedDisplay)} staked`, tone: 'good' }
    return flow === 'airdrop'
        ? { text: 'Nothing staked · airdrop waits', tone: 'warn', disabled: true }
        : { text: 'Nothing staked yet', tone: 'muted' }
}

/** The picked token's compounded reward can take this prize: it is loaded, it exists, and for an airdrop something is staked. */
export function stakedTokenOk(flow: PrizeFlow, read: { denomReward?: Pick<DenomReward, 'staked_amount'>; isLoading: boolean; hasError: boolean }): boolean {
    if (read.isLoading || read.hasError || !read.denomReward) return false
    return flow !== 'airdrop' || new BigNumber(read.denomReward.staked_amount || 0).gt(0)
}

/** Why an airdrop to `ticker` stakers can't be picked: nobody stakes it. */
export const nothingStakedReason = (ticker: string) =>
    `Nobody is staking ${ticker} yet, so there is no one to pay. The chain refuses an airdrop when nothing is staked. Nothing would leave your wallet.`

/**
 * "BZE is a new prize token here: +25,000 TBZE, uses 1 of the remaining 4 prize slots." ('' for a
 * prize the reward already pays, or once the cap is reached: the blocker says so then.)
 */
export function newPrizeNote(prizeTicker: string, feeText: string, slot: PrizeSlot, max?: number): string {
    if (!slot.isNewPrize || slot.capReached) return ''
    const fee = feeText ? `+${feeText}` : 'the new prize fee applies'
    const slots = max === undefined
        ? 'uses 1 prize slot for good'
        : `uses 1 of the remaining ${Math.max(0, max - slot.used).toLocaleString('en-US')} prize slots`
    return `${prizeTicker} is a new prize token here: ${fee}, ${slots}.`
}

/** The read-only facts of a schedule being extended, and what `extraInput` more days do. */
export interface ScheduleExtendFacts {
    daysLeft: number;
    /** "26 Oct" (today + the days left); days without stakers push it later. */
    end: string;
    /** How many days still fit under 36,500. */
    room: number;
    /** '' when the extra days are valid. */
    error: string;
    /** The extra days, once valid. */
    extra?: number;
    /** daily × extra, base units, once valid. */
    escrow?: BigNumber;
    newEnd?: string;
}

export function scheduleExtendFacts(
    schedule: Pick<DenomRewardSchedule, 'daily_amount' | 'duration' | 'payouts'>,
    extraInput: string,
    now: Date,
): ScheduleExtendFacts {
    const daysLeft = scheduleDaysLeft(schedule)
    const end = formatDay(addDays(now, daysLeft), now)
    const room = Math.max(0, MAX_SCHEDULE_DAYS - schedule.duration)
    const error = validateScheduleDays(extraInput, schedule.duration)
    if (error !== '') return { daysLeft, end, room, error }

    const extra = Number(extraInput.trim())
    return {
        daysLeft,
        end,
        room,
        error,
        extra,
        escrow: new BigNumber(schedule.daily_amount).multipliedBy(extra),
        newEnd: formatDay(addDays(now, daysLeft + extra), now),
    }
}

/**
 * The schedule a "Start daily prize" tx just created: the newest one with its prize, daily amount
 * and days, not paid yet. The tx keeps only the hash, so the Done screen finds it on chain.
 */
export function findNewSchedule<T extends Pick<DenomRewardSchedule, 'schedule_id' | 'prize_denom' | 'daily_amount' | 'duration' | 'payouts'>>(
    schedules: T[],
    added: { prizeDenom: string; dailyAmount: string; days: number },
): T | undefined {
    const matches = schedules.filter(s => s.prize_denom === added.prizeDenom
        && new BigNumber(s.daily_amount).eq(added.dailyAmount)
        && s.duration === added.days
        && s.payouts === 0)
    return matches.sort((a, b) => b.schedule_id.localeCompare(a.schedule_id, 'en', { numeric: true }))[0]
}

/** What a prize wizard hands its Done screen (kept in the pending-tx store, so serialisable). */
export interface PrizeDoneInput {
    kind: 'add' | 'extend' | 'airdrop';
    stakedDenom: string;
    stakedTicker: string;
    prizeDenom: string;
    prizeTicker: string;
    /** add / extend: the daily amount, formatted: "50". */
    perDay?: string;
    /** add: base units, to find the new schedule. */
    dailyAmount?: string;
    /** add: the payout days; extend: the days added. */
    days?: number;
    /** extend: the schedule. */
    scheduleId?: string;
    /** extend: the new last day, "5 Nov". */
    newEnd?: string;
    /** airdrop: "10,000". */
    amount?: string;
}

const dayCount = (n: number) => `${n.toLocaleString('en-US')} day${n === 1 ? '' : 's'}`

/** The Done title: "**50 BZE a day** for HONEY stakers.", "**10,000 BEE** sent to HONEY stakers." */
export function prizeDoneTitle(input: PrizeDoneInput): string {
    const { kind, stakedTicker, prizeTicker, perDay, days, amount } = input
    if (kind === 'airdrop') return `**${amount} ${prizeTicker}** sent to ${stakedTicker} stakers.`
    if (kind === 'extend') {
        const n = days ?? 0
        return `**${n.toLocaleString('en-US')} more day${n === 1 ? '' : 's'}** for ${stakedTicker} stakers.`
    }
    return `**${perDay} ${prizeTicker} a day** for ${stakedTicker} stakers.`
}

/** The line under the Done title. */
export function prizeDoneText(input: PrizeDoneInput): string {
    const { kind, stakedTicker, prizeTicker, perDay, days, newEnd } = input
    if (kind === 'airdrop') return `Everyone staking ${stakedTicker} got a share, split by stake. They can claim it right away.`
    if (kind === 'extend') return `Everyone staking ${stakedTicker} keeps sharing ${perDay} ${prizeTicker} a day until about ${newEnd}.`
    return `Everyone staking ${stakedTicker} shares ${perDay} ${prizeTicker} a day for ${dayCount(days ?? 0)}.`
}

/** The key number for the announcement: "50 BZE a day for 30 days", "10,000 BEE, airdropped". */
export function prizeAnnouncement(input: PrizeDoneInput): string {
    const { kind, prizeTicker, perDay, days, newEnd, amount } = input
    if (kind === 'airdrop') return `${amount} ${prizeTicker}, airdropped`
    if (kind === 'extend') return `${perDay} ${prizeTicker} a day until about ${newEnd}`
    return `${perDay} ${prizeTicker} a day for ${dayCount(days ?? 0)}`
}
