import BigNumber from 'bignumber.js'
import type { DenomReward } from '@bze/bze-ui-kit'
import type { StakingRewardSDKType } from '@bze/bzejs/bze/rewards/store'
import { addDays, formatDay } from '@/lib/reward-extend'
import { isStakingRewardFinished } from '@/lib/staking-rewards'

// The rewards directory (`/rewards?kind=…&filter=…&sort=…&status=…&q=…`, BFE-153 / BFE-161 / BFE-272): its
// URL state, the search by staked token, and the filter and sort of both sections (compounded rewards,
// one per staked token, and simple rewards). Pure, so the page stays a thin view over it.

export const REWARDS_PATH = '/rewards'

export const REWARD_KINDS = ['all', 'compounded', 'simple'] as const
export const REWARD_FILTERS = ['all', 'stakers', 'paying', 'mine'] as const
export const REWARD_SORTS = ['staked', 'prizes', 'name'] as const
export const SIMPLE_STATUSES = ['all', 'running', 'finished'] as const

export type RewardKind = typeof REWARD_KINDS[number]
export type RewardFilter = typeof REWARD_FILTERS[number]
export type RewardSort = typeof REWARD_SORTS[number]
export type SimpleStatus = typeof SIMPLE_STATUSES[number]

export interface RewardsView {
    /** Which sections show: both, or one kind. */
    kind: RewardKind;
    /** "Paying now" only applies to compounded rewards; the others to both sections. */
    filter: RewardFilter;
    sort: RewardSort;
    /** Simple rewards only: running or finished. */
    status: SimpleStatus;
    /** Search by staked token, as typed. */
    q: string;
    /** The token a deep link asked for (`/denom-reward/token?denom=` redirects here): prefills the search. */
    denom: string;
}

export const DEFAULT_REWARDS_VIEW: RewardsView = { kind: 'all', filter: 'all', sort: 'staked', status: 'all', q: '', denom: '' }

const pick = <T extends string>(values: readonly T[], value: string | null | undefined): T | undefined =>
    values.find(v => v === value)

// The directory had two tabs before BFE-272: `tab=holder` (compounded) and `tab=programs` (simple).
const LEGACY_TABS: Record<string, RewardKind> = { holder: 'compounded', programs: 'simple' }

/** URL query → view; missing or unknown values fall back to the defaults, an old `tab=` to its kind. */
export function parseRewardsView(get: (key: string) => string | null | undefined): RewardsView {
    return {
        kind: pick(REWARD_KINDS, get('kind')) ?? LEGACY_TABS[get('tab') ?? ''] ?? DEFAULT_REWARDS_VIEW.kind,
        filter: pick(REWARD_FILTERS, get('filter')) ?? DEFAULT_REWARDS_VIEW.filter,
        sort: pick(REWARD_SORTS, get('sort')) ?? DEFAULT_REWARDS_VIEW.sort,
        status: pick(SIMPLE_STATUSES, get('status')) ?? DEFAULT_REWARDS_VIEW.status,
        q: get('q') ?? '',
        denom: get('denom') ?? '',
    }
}

/** View → link. Kind, filter, sort and status are always written; the search and the deep-linked token only when set. */
export function rewardsHref(view: Partial<RewardsView> = {}): string {
    const { kind, filter, sort, status, q, denom } = { ...DEFAULT_REWARDS_VIEW, ...view }
    const params = new URLSearchParams({ kind, filter, sort, status })
    if (q.trim() !== '') params.set('q', q)
    if (denom !== '') params.set('denom', denom)
    return `${REWARDS_PATH}?${params.toString()}`
}

/** The search box's text: what was typed, else the deep-linked token. */
export const searchText = (view: Pick<RewardsView, 'q' | 'denom'>) => view.q || view.denom

/** "Created by you": the staked token's denom carries the connected wallet's `factory/<address>/` prefix. */
export const createdBy = (denom: string, address: string | undefined) =>
    !!address && denom.startsWith(`factory/${address}/`)

/** What the search looks at: the staked token. */
export interface StakedToken {
    denom: string;
    ticker: string;
    name?: string;
}

/**
 * Search by staked token: ticker, name or denom, ignoring case. A search that is exactly the
 * deep-linked denom matches that denom only, so `?denom=ubze` doesn't also list every LP share
 * whose denom ends in `ubze`.
 */
export function matchesStakedToken(token: StakedToken, q: string, deepLinked: string = ''): boolean {
    const needle = q.trim()
    if (needle === '') return true
    if (deepLinked !== '' && needle === deepLinked) return token.denom === deepLinked
    const lower = needle.toLowerCase()
    return [token.ticker, token.name ?? '', token.denom].some(v => v.toLowerCase().includes(lower))
}

/** Per-DR counts from its prize and schedule lists. */
export interface DenomRewardCounts {
    /** Prize entries: every prize denom the DR ever used. */
    prizes: number;
    /** Running daily schedules (the chain deletes finished ones). */
    schedules: number;
    /** Distinct prize denoms of the running schedules, in first-seen order. */
    payingDenoms: string[];
}

export function toCounts(prizes: ReadonlyArray<unknown>, schedules: ReadonlyArray<{ prize_denom: string }>): DenomRewardCounts {
    return {
        prizes: prizes.length,
        schedules: schedules.length,
        payingDenoms: Array.from(new Set(schedules.map(s => s.prize_denom))),
    }
}

/** A staked amount and what one display unit is worth, for "Most staked". */
interface Staked {
    /** `staked_amount` in display units. */
    stakedDisplay: BigNumber;
    /** USD price of one display unit; 0 or undefined when unknown. */
    usdPrice?: BigNumber;
}

/** One compounded reward card as the page knows it right now. */
export interface HolderRow extends Staked {
    dr: DenomReward;
    /** Display name used by the A–Z sort and the search (ticker, else the denom). */
    ticker: string;
    name?: string;
    /** undefined while loading, null when the queries failed. */
    counts: DenomRewardCounts | null | undefined;
}

/** One simple reward row. */
export interface SimpleRow extends Staked {
    reward: StakingRewardSDKType;
    /** The staked token's ticker (else its denom), for the A–Z sort and the search. */
    ticker: string;
    name?: string;
    /** `prize_amount` a day, in display units. */
    prizeDisplay: BigNumber;
    /** USD price of one display unit of the prize; 0 or undefined when unknown. */
    prizeUsdPrice?: BigNumber;
}

export const hasStakers = (dr: Pick<DenomReward, 'staked_amount'>) => new BigNumber(dr.staked_amount || 0).gt(0)

/** Visible reason the Airdrop button is disabled, or '' (chain error 5018 refuses an airdrop without stakers). */
export const airdropDisabledReason = (dr: Pick<DenomReward, 'staked_amount'>) =>
    hasStakers(dr) ? '' : 'Nothing staked yet'

/**
 * Compounded rows the filter keeps. "Paying now" needs the counts: a row still loading stays in
 * the list (with its skeleton) instead of disappearing and coming back; a row whose counts failed
 * is left out, since it can't be shown as paying.
 */
export function filterHolderRows<T extends HolderRow>(rows: ReadonlyArray<T>, filter: RewardFilter, address?: string): T[] {
    switch (filter) {
        case 'stakers':
            return rows.filter(r => hasStakers(r.dr))
        case 'paying':
            return rows.filter(r => r.counts === undefined || (r.counts !== null && r.counts.schedules > 0))
        case 'mine':
            return rows.filter(r => createdBy(r.dr.staking_denom, address))
        default:
            return [...rows]
    }
}

/** Simple rows the filter and the status keep. "Paying now" is about daily prizes: simple rows ignore it. */
export function filterSimpleRows<T extends SimpleRow>(rows: ReadonlyArray<T>, filter: RewardFilter, status: SimpleStatus, address?: string): T[] {
    return rows.filter(r => {
        if (filter === 'stakers' && !hasStakers(r.reward)) return false
        if (filter === 'mine' && !createdBy(r.reward.staking_denom, address)) return false
        if (status === 'running') return !isStakingRewardFinished(r.reward)
        if (status === 'finished') return isStakingRewardFinished(r.reward)
        return true
    })
}

const knownPrice = (p?: BigNumber) => p !== undefined && p.gt(0)

/**
 * Bigger value first. Display amounts of different tokens aren't comparable (1 BZE ≠ 1 TOK), so
 * two amounts whose USD prices are both known compare by USD value; otherwise they fall back to
 * the raw display amount. The fallback keeps tokens without a market sortable.
 */
function compareValue(a: BigNumber, aPrice: BigNumber | undefined, b: BigNumber, bPrice: BigNumber | undefined): number {
    if (knownPrice(aPrice) && knownPrice(bPrice)) {
        return b.multipliedBy(bPrice!).comparedTo(a.multipliedBy(aPrice!)) ?? 0
    }
    return b.comparedTo(a) ?? 0
}

const compareStaked = (a: Staked, b: Staked) => compareValue(a.stakedDisplay, a.usdPrice, b.stakedDisplay, b.usdPrice)

const compareTicker = (a: { ticker: string }, b: { ticker: string }) => a.ticker.localeCompare(b.ticker, 'en', { sensitivity: 'base' })

/** Sorts with the chain order breaking ties; never mutates its input. */
function stableSort<T>(rows: ReadonlyArray<T>, cmp: (a: T, b: T) => number): T[] {
    return rows.map((row, i) => ({ row, i })).sort((x, y) => cmp(x.row, y.row) || x.i - y.i).map(x => x.row)
}

/**
 * Compounded rows in the chosen order; ties keep the chain order. "Most prize tokens" needs the
 * counts: rows still loading keep their slot, and only the loaded rows (failed ones last) are
 * sorted into the other slots, so nothing jumps around while the counts arrive.
 */
export function sortHolderRows<T extends HolderRow>(rows: ReadonlyArray<T>, sort: RewardSort): T[] {
    if (sort === 'staked') return stableSort(rows, compareStaked)
    if (sort === 'name') return stableSort(rows, (a, b) => compareTicker(a, b) || a.dr.staking_denom.localeCompare(b.dr.staking_denom))

    const prizes = (r: T) => (r.counts ? r.counts.prizes : -1)
    const sorted = stableSort(rows.filter(r => r.counts !== undefined), (a, b) => prizes(b) - prizes(a))
    let next = 0
    return rows.map(r => (r.counts === undefined ? r : sorted[next++]))
}

/**
 * Simple rows in the chosen order, running ones first; ties keep the chain order (newest first).
 * "Most prize tokens" compares the prize paid a day, by USD value when both prices are known.
 */
export function sortSimpleRows<T extends SimpleRow>(rows: ReadonlyArray<T>, sort: RewardSort): T[] {
    const byKind = (a: T, b: T) =>
        Number(isStakingRewardFinished(a.reward)) - Number(isStakingRewardFinished(b.reward))
    const bySort = sort === 'staked'
        ? compareStaked
        : sort === 'prizes'
            ? (a: T, b: T) => compareValue(a.prizeDisplay, a.prizeUsdPrice, b.prizeDisplay, b.prizeUsdPrice)
            : (a: T, b: T) => compareTicker(a, b) || a.reward.staking_denom.localeCompare(b.reward.staking_denom)
    return stableSort(rows, (a, b) => byKind(a, b) || bySort(a, b))
}

/** A running daily prize: "50 BZE a day · ends 26 Oct" (days without stakers are skipped, so it may end later). */
export const dailyPrizeEnd = (perDay: string, daysLeft: number, now: Date) =>
    `${perDay} a day · ends ${formatDay(addDays(now, daysLeft), now)}`
