import BigNumber from 'bignumber.js'
import type { DenomReward, DenomRewardSchedule } from '@bze/bze-ui-kit'
import { MAX_SCHEDULE_DAYS, scheduleDaysLeft, validateScheduleDays } from '@/lib/denom-reward'
import { formatDate } from '@/lib/format'
import { addDays } from '@/lib/reward-extend'

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
        ? { text: 'Nothing staked', tone: 'warn', disabled: true }
        : { text: 'Nothing staked', tone: 'muted' }
}

/** The picked token's compounded reward can take this prize: it is loaded, it exists, and for an airdrop something is staked. */
export function stakedTokenOk(flow: PrizeFlow, read: { denomReward?: Pick<DenomReward, 'staked_amount'>; isLoading: boolean; hasError: boolean }): boolean {
    if (read.isLoading || read.hasError || !read.denomReward) return false
    return flow !== 'airdrop' || new BigNumber(read.denomReward.staked_amount || 0).gt(0)
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
    const end = formatDate(addDays(now, daysLeft), now)
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
        newEnd: formatDate(addDays(now, daysLeft + extra), now),
    }
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
    if (kind === 'airdrop') return `${stakedTicker} stakers got a share, split by stake. They can claim it right away.`
    if (kind === 'extend') return `${stakedTicker} stakers keep sharing ${perDay} ${prizeTicker} a day until ${newEnd}.`
    return `${stakedTicker} stakers share ${perDay} ${prizeTicker} a day for ${dayCount(days ?? 0)}.`
}
