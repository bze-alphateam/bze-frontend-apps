import BigNumber from 'bignumber.js'
import type { StakingRewardSDKType } from '@bze/bzejs/bze/rewards/store'
import { formatDate } from '@/lib/format'
import { MAX_DURATION_DAYS } from '@/lib/reward-new'

// Extend a simple reward (BFE-264). MsgUpdateStakingReward is permissionless: anyone escrows
// prize_amount × days and the reward pays that many more days. The daily prize, the staked
// token, the lock and the minimum never change, and the total can't pass 36,500 days.

type RewardDays = Pick<StakingRewardSDKType, 'duration' | 'payouts'>

const DAY_MS = 24 * 60 * 60 * 1000

export const EXTEND_PATH = '/reward/extend'

/** The Extend wizard for one reward, or its reward list without an id. */
export const extendHref = (rewardId?: string) =>
    rewardId ? `${EXTEND_PATH}?id=${encodeURIComponent(rewardId)}` : EXTEND_PATH

/** `payouts` grows by one each day while it is below `duration`. */
export const daysLeft = (reward: RewardDays) => Math.max(0, reward.duration - reward.payouts)

export const isFinished = (reward: RewardDays) => daysLeft(reward) === 0

/** How many days can still be added under the chain's 36,500-day cap. */
export const extendRoom = (reward: Pick<StakingRewardSDKType, 'duration'>) => Math.max(0, MAX_DURATION_DAYS - reward.duration)

/** `now` + `n` days. */
export const addDays = (now: Date, n: number) => new Date(now.getTime() + n * DAY_MS)

/** When the last day is paid: today + the days left (a finished reward: today). */
export const endDate = (reward: RewardDays, now: Date) => addDays(now, daysLeft(reward))

/**
 * The end after paying `extra` more days. A finished reward starts paying again, so its new end
 * is today + extra.
 */
export const newEndDate = (reward: RewardDays, extra: number, now: Date) => addDays(now, daysLeft(reward) + extra)

/** "6 of 30 · ends 26 Oct", or "Finished · all 30 paid". */
export function daysLeftText(reward: RewardDays, now: Date): string {
    const total = reward.duration.toLocaleString('en-US')
    if (isFinished(reward)) return `Finished · all ${total} paid`
    return `${daysLeft(reward).toLocaleString('en-US')} of ${total} · ends ${formatDate(endDate(reward, now), now)}`
}

/** Extra days: a whole number from 1 up to the room left under the cap. */
export function validateExtraDays(value: string, reward: Pick<StakingRewardSDKType, 'duration'>): string {
    const trimmed = value.trim()
    if (!trimmed) return 'Required.'
    if (!/^\d+$/.test(trimmed) || Number(trimmed) < 1) return 'Enter a whole number of days.'
    const room = extendRoom(reward)
    if (room === 0) return `Max ${MAX_DURATION_DAYS} days reached.`
    if (Number(trimmed) > room) return `Max ${room} days.`
    return ''
}

/** What leaves the wallet: the fixed daily prize × the extra days, in base units. */
export const extendCost = (reward: Pick<StakingRewardSDKType, 'prize_amount'>, extra: string | number) =>
    new BigNumber(reward.prize_amount).multipliedBy(extra)

/** MsgUpdateStakingReward's value: `duration` is the number of days added, not the new total. */
export const extendMsgValue = ({ creator, rewardId, days }: { creator: string; rewardId: string; days: string }) =>
    ({ creator, rewardId, duration: days.trim() })

/** Running rewards whose staked (or prize) ticker matches the search, in the chain's order. */
export function searchRunningRewards<T extends RewardDays & Pick<StakingRewardSDKType, 'staking_denom' | 'prize_denom'>>(
    rewards: T[],
    query: string,
    ticker: (denom: string) => string,
): T[] {
    const q = query.trim().toLowerCase()
    return rewards
        .filter(r => !isFinished(r))
        .filter(r => !q || [ticker(r.staking_denom), r.staking_denom, ticker(r.prize_denom)].some(s => s.toLowerCase().includes(q)))
}
