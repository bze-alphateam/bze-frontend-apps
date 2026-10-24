import BigNumber from 'bignumber.js'
import type { DenomReward, DenomRewardSchedule } from '@bze/bze-ui-kit'
import type { StakingRewardSDKType } from '@bze/bzejs/bze/rewards/store'
import { isStakingRewardFinished } from '@/lib/staking-rewards'

// The rewards directory (`/rewards?kind=…&filter=…&sort=…&q=…`, BFE-153 / BFE-161 / BFE-272): its
// URL state, the search by staked token, and the grouping of every reward by the token it stakes
// (one row per token: its compounded reward, then its simple rewards). Pure, so the page stays a
// thin view over it.

export const REWARDS_PATH = '/rewards'

export const REWARD_KINDS = ['all', 'compounded', 'simple'] as const
export const REWARD_FILTERS = ['all', 'stakers', 'paying', 'mine', 'running', 'finished'] as const
export const REWARD_SORTS = ['staked', 'prizes', 'name'] as const

export type RewardKind = typeof REWARD_KINDS[number]
export type RewardFilter = typeof REWARD_FILTERS[number]
export type RewardSort = typeof REWARD_SORTS[number]

export interface RewardsView {
    /** Which rewards show: both kinds, or one. */
    kind: RewardKind;
    filter: RewardFilter;
    sort: RewardSort;
    /** Search by staked token, as typed. */
    q: string;
    /** The token a deep link asked for (`/denom-reward/token?denom=` redirects here): prefills the search and opens its row. */
    denom: string;
}

export const DEFAULT_REWARDS_VIEW: RewardsView = { kind: 'all', filter: 'all', sort: 'staked', q: '', denom: '' }

const pick = <T extends string>(values: readonly T[], value: string | null | undefined): T | undefined =>
    values.find(v => v === value)

// The directory had two tabs before BFE-272: `tab=holder` (compounded) and `tab=programs` (simple).
const LEGACY_TABS: Record<string, RewardKind> = { holder: 'compounded', programs: 'simple' }
// Running and Finished were their own `status=` chips before they joined the filter.
const LEGACY_STATUSES: Record<string, RewardFilter> = { running: 'running', finished: 'finished' }

/** URL query → view; missing or unknown values fall back to the defaults, an old `tab=` or `status=` to its value. */
export function parseRewardsView(get: (key: string) => string | null | undefined): RewardsView {
    const filter = pick(REWARD_FILTERS, get('filter'))
    return {
        kind: pick(REWARD_KINDS, get('kind')) ?? LEGACY_TABS[get('tab') ?? ''] ?? DEFAULT_REWARDS_VIEW.kind,
        filter: (filter && filter !== 'all' ? filter : undefined) ?? LEGACY_STATUSES[get('status') ?? ''] ?? DEFAULT_REWARDS_VIEW.filter,
        sort: pick(REWARD_SORTS, get('sort')) ?? DEFAULT_REWARDS_VIEW.sort,
        q: get('q') ?? '',
        denom: get('denom') ?? '',
    }
}

/** View → link. Kind, filter and sort are always written; the search and the deep-linked token only when set. */
export function rewardsHref(view: Partial<RewardsView> = {}): string {
    const { kind, filter, sort, q, denom } = { ...DEFAULT_REWARDS_VIEW, ...view }
    const params = new URLSearchParams({ kind, filter, sort })
    if (q.trim() !== '') params.set('q', q)
    if (denom !== '') params.set('denom', denom)
    return `${REWARDS_PATH}?${params.toString()}`
}

/** The search box's text: what was typed, else the deep-linked token. */
export const searchText = (view: Pick<RewardsView, 'q' | 'denom'>) => view.q || view.denom

/** "Yours": the staked token's denom carries the connected wallet's `factory/<address>/` prefix. */
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

const staked = (amount: BigNumber.Value | undefined) => new BigNumber(amount || 0)

export const hasStakers = (reward: { staked_amount?: string }) => staked(reward.staked_amount).gt(0)

/** Visible reason the Airdrop button is disabled, or '' (chain error 5018 refuses an airdrop without stakers). */
export const airdropDisabledReason = (dr: Pick<DenomReward, 'staked_amount'>) =>
    hasStakers(dr) ? '' : 'Nothing staked yet'

/**
 * A compounded reward's running daily prizes: undefined while they load, null when the query
 * failed (the chain deletes finished schedules, so every listed one is running).
 */
export type CompoundedSchedules = DenomRewardSchedule[] | null | undefined

/** The DEX staking list's statuses (`statusText` in apps/dex), so both apps say the same. */
export type RewardStatus = 'paying' | 'airdrops' | 'running' | 'waiting' | 'finished'

export const STATUS_TEXT: Record<RewardStatus, string> = {
    paying: 'Paying daily',
    airdrops: 'Airdrops only',
    running: 'Running',
    waiting: 'Waiting for stakers',
    finished: 'Finished',
}

/** A compounded reward pays daily while it has a daily prize; else it only passes on airdrops. Unknown while loading. */
export const compoundedStatus = (schedules: CompoundedSchedules): RewardStatus | undefined =>
    schedules ? (schedules.length > 0 ? 'paying' : 'airdrops') : undefined

export const simpleStatus = (reward: Pick<StakingRewardSDKType, 'payouts' | 'duration' | 'staked_amount'>): RewardStatus =>
    isStakingRewardFinished(reward) ? 'finished' : hasStakers(reward) ? 'running' : 'waiting'

/** A lock in days as "21d" (the DEX's `formatLockPeriod`); no lock is "instant". */
export const formatLock = (days: number) => (days > 0 ? `${Math.round(days)}d` : 'instant')

/** "Unlock 7d · Min 100 BZE · Running": the DEX spec line. No minimum, no "Min"; no status while unknown. */
export const specLine = (lockDays: number, minStake: string, status: RewardStatus | undefined) =>
    [`Unlock ${formatLock(lockDays)}`, minStake ? `Min ${minStake}` : '', status ? STATUS_TEXT[status] : '']
        .filter(Boolean)
        .join(' · ')

/** "500 VDL / day · 16 / 30 days": the daily amount and the DEX's Elapsed / Duration. */
export const perDayLine = (perDay: string, done: number, duration: number) =>
    `${perDay} / day · ${done.toLocaleString('en-US')} / ${duration.toLocaleString('en-US')} days`

/** Does the filter keep this compounded reward? A row still loading its daily prizes stays for "Paying daily". */
export function keepsCompounded(dr: Pick<DenomReward, 'staked_amount'>, schedules: CompoundedSchedules, filter: RewardFilter): boolean {
    switch (filter) {
        case 'stakers':
            return hasStakers(dr)
        case 'paying':
            return schedules === undefined || (schedules !== null && schedules.length > 0)
        // Compounded rewards never end: they are always running, never finished.
        case 'finished':
            return false
        default:
            return true
    }
}

/** Does the filter keep this simple reward? "Paying daily" is a running one with stakers. */
export function keepsSimple(reward: StakingRewardSDKType, filter: RewardFilter): boolean {
    switch (filter) {
        case 'stakers':
            return hasStakers(reward)
        case 'paying':
            return simpleStatus(reward) === 'running'
        case 'running':
            return !isStakingRewardFinished(reward)
        case 'finished':
            return isStakingRewardFinished(reward)
        default:
            return true
    }
}

/** One row of the directory: a staked token and the rewards that stake it. */
export interface RewardGroup extends StakedToken {
    compounded?: DenomReward;
    /** The compounded reward's running daily prizes (see {@link CompoundedSchedules}). */
    schedules: CompoundedSchedules;
    /** Running ones first, then as the chain lists them (newest first). */
    simple: StakingRewardSDKType[];
    /** Staked in all the listed rewards, in display units. */
    stakedDisplay: BigNumber;
    /** USD price of one display unit; 0 or undefined when unknown. */
    usdPrice?: BigNumber;
    /** Prize denoms: the compounded reward's daily prizes, then the running simple rewards' prizes. */
    earn: string[];
}

export const rewardCount = (group: Pick<RewardGroup, 'compounded' | 'simple'>) => (group.compounded ? 1 : 0) + group.simple.length

/** What grouping needs to know about a token. */
export interface TokenLookup {
    token: (denom: string) => StakedToken & { decimals: number };
    usdPrice: (denom: string) => BigNumber | undefined;
}

export interface GroupInput {
    compounded: ReadonlyArray<DenomReward>;
    /** Per staking denom; missing while loading, null when failed. */
    schedules: Record<string, DenomRewardSchedule[] | null>;
    simple: ReadonlyArray<StakingRewardSDKType>;
    view: Pick<RewardsView, 'kind' | 'filter' | 'q' | 'denom'>;
    address?: string;
}

/**
 * The rows the view keeps: every kept reward under its staked token, in chain order (compounded
 * rewards first). The search and "Yours" look at the token; the other filters at each reward, and
 * a token left with no reward drops out.
 */
export function groupRewards(input: GroupInput, lk: TokenLookup): RewardGroup[] {
    const { view, address } = input
    const groups = new Map<string, RewardGroup>()
    const groupOf = (denom: string) => {
        let group = groups.get(denom)
        if (!group) {
            const { ticker, name } = lk.token(denom)
            group = { denom, ticker, name, schedules: undefined, simple: [], stakedDisplay: new BigNumber(0), usdPrice: lk.usdPrice(denom), earn: [] }
            groups.set(denom, group)
        }
        return group
    }
    const tokenKept = (denom: string) =>
        matchesStakedToken(lk.token(denom), view.q, view.denom) && (view.filter !== 'mine' || createdBy(denom, address))
    const addStaked = (group: RewardGroup, amount: string | undefined) => {
        group.stakedDisplay = group.stakedDisplay.plus(staked(amount).shiftedBy(-lk.token(group.denom).decimals))
    }
    const addEarn = (group: RewardGroup, denom: string) => {
        if (!group.earn.includes(denom)) group.earn.push(denom)
    }

    if (view.kind !== 'simple') {
        input.compounded.forEach(dr => {
            const denom = dr.staking_denom
            const schedules = denom in input.schedules ? input.schedules[denom] : undefined
            if (!tokenKept(denom) || !keepsCompounded(dr, schedules, view.filter)) return
            const group = groupOf(denom)
            group.compounded = dr
            group.schedules = schedules
            addStaked(group, dr.staked_amount)
            schedules?.forEach(s => addEarn(group, s.prize_denom))
        })
    }
    if (view.kind !== 'compounded') {
        input.simple.forEach(reward => {
            if (!tokenKept(reward.staking_denom) || !keepsSimple(reward, view.filter)) return
            const group = groupOf(reward.staking_denom)
            group.simple.push(reward)
            addStaked(group, reward.staked_amount)
            if (!isStakingRewardFinished(reward)) addEarn(group, reward.prize_denom)
        })
    }
    const finishedLast = (a: StakingRewardSDKType, b: StakingRewardSDKType) =>
        Number(isStakingRewardFinished(a)) - Number(isStakingRewardFinished(b))
    return [...groups.values()].map(group => ({ ...group, simple: stableSort(group.simple, finishedLast) }))
}

const knownPrice = (p?: BigNumber) => p !== undefined && p.gt(0)

/**
 * Bigger staked value first. Display amounts of different tokens aren't comparable (1 BZE ≠ 1 TOK),
 * so two rows whose USD prices are both known compare by USD value; otherwise they fall back to the
 * raw display amount. The fallback keeps tokens without a market sortable.
 */
function compareStaked(a: RewardGroup, b: RewardGroup): number {
    if (knownPrice(a.usdPrice) && knownPrice(b.usdPrice)) {
        return b.stakedDisplay.multipliedBy(b.usdPrice!).comparedTo(a.stakedDisplay.multipliedBy(a.usdPrice!)) ?? 0
    }
    return b.stakedDisplay.comparedTo(a.stakedDisplay) ?? 0
}

const compareTicker = (a: RewardGroup, b: RewardGroup) =>
    a.ticker.localeCompare(b.ticker, 'en', { sensitivity: 'base' }) || a.denom.localeCompare(b.denom)

/** Sorts with the chain order breaking ties; never mutates its input. */
function stableSort<T>(rows: ReadonlyArray<T>, cmp: (a: T, b: T) => number): T[] {
    return rows.map((row, i) => ({ row, i })).sort((x, y) => cmp(x.row, y.row) || x.i - y.i).map(x => x.row)
}

/** Its compounded reward's daily prizes are still loading, so what it earns isn't known yet. */
const earnPending = (g: RewardGroup) => g.compounded !== undefined && g.schedules === undefined

/**
 * Rows in the chosen order; ties keep the chain order. "Most prize tokens" counts what each row
 * earns: rows still loading keep their slot and only the loaded rows are sorted into the other
 * slots, so nothing jumps around while the daily prizes arrive.
 */
export function sortRewardGroups(groups: ReadonlyArray<RewardGroup>, sort: RewardSort): RewardGroup[] {
    if (sort === 'staked') return stableSort(groups, compareStaked)
    if (sort === 'name') return stableSort(groups, compareTicker)

    const sorted = stableSort(groups.filter(g => !earnPending(g)), (a, b) => b.earn.length - a.earn.length)
    let next = 0
    return groups.map(g => (earnPending(g) ? g : sorted[next++]))
}
