import BigNumber from 'bignumber.js'
import type { DenomReward } from '@bze/bze-ui-kit'

// The rewards directory (`/rewards?tab=…&filter=…&sort=…&status=…`, BFE-153 / BFE-161): its URL state and the
// filter and sort of the Compounded rewards rows. Pure, so the page stays a thin view over it.

export const REWARDS_PATH = '/rewards'

export const REWARDS_TABS = ['holder', 'programs'] as const
export const HOLDER_FILTERS = ['all', 'stakers', 'paying'] as const
export const HOLDER_SORTS = ['staked', 'prizes', 'name'] as const
export const PROGRAM_STATUSES = ['all', 'running', 'finished'] as const

export type RewardsTab = typeof REWARDS_TABS[number]
export type HolderFilter = typeof HOLDER_FILTERS[number]
export type HolderSort = typeof HOLDER_SORTS[number]
export type ProgramStatus = typeof PROGRAM_STATUSES[number]

export interface RewardsView {
    tab: RewardsTab;
    filter: HolderFilter;
    sort: HolderSort;
    /** Simple rewards tab: which programs to show. */
    status: ProgramStatus;
}

export const DEFAULT_REWARDS_VIEW: RewardsView = { tab: 'holder', filter: 'all', sort: 'staked', status: 'all' }

const pick = <T extends string>(values: readonly T[], value: string | null | undefined, fallback: T): T =>
    values.find(v => v === value) ?? fallback

/** URL query → view; missing or unknown values fall back to the defaults. */
export function parseRewardsView(get: (key: string) => string | null | undefined): RewardsView {
    return {
        tab: pick(REWARDS_TABS, get('tab'), DEFAULT_REWARDS_VIEW.tab),
        filter: pick(HOLDER_FILTERS, get('filter'), DEFAULT_REWARDS_VIEW.filter),
        sort: pick(HOLDER_SORTS, get('sort'), DEFAULT_REWARDS_VIEW.sort),
        status: pick(PROGRAM_STATUSES, get('status'), DEFAULT_REWARDS_VIEW.status),
    }
}

/** View → link; every value is written so a shared link opens exactly this view. */
export function rewardsHref(view: Partial<RewardsView> = {}): string {
    const { tab, filter, sort, status } = { ...DEFAULT_REWARDS_VIEW, ...view }
    return `${REWARDS_PATH}?tab=${tab}&filter=${filter}&sort=${sort}&status=${status}`
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

/** One directory row as the page knows it right now. */
export interface HolderRow {
    dr: DenomReward;
    /** Display name used by the A–Z sort (ticker, else the denom). */
    ticker: string;
    /** `staked_amount` in display units. */
    stakedDisplay: BigNumber;
    /** USD price of one display unit; 0 or undefined when unknown. */
    usdPrice?: BigNumber;
    /** undefined while loading, null when the queries failed. */
    counts: DenomRewardCounts | null | undefined;
}

export const hasStakers = (dr: Pick<DenomReward, 'staked_amount'>) => new BigNumber(dr.staked_amount || 0).gt(0)

/** Visible reason the Airdrop button is disabled, or '' (chain error 5018 refuses an airdrop without stakers). */
export const airdropDisabledReason = (dr: Pick<DenomReward, 'staked_amount'>) =>
    hasStakers(dr) ? '' : 'No stakers, nobody to airdrop to'

/**
 * Rows the filter keeps. "Paying now" needs the counts: a row still loading stays in the list
 * (with its skeleton) instead of disappearing and coming back; a row whose counts failed is left
 * out, since it can't be shown as paying.
 */
export function filterHolderRows(rows: ReadonlyArray<HolderRow>, filter: HolderFilter): HolderRow[] {
    switch (filter) {
        case 'stakers':
            return rows.filter(r => hasStakers(r.dr))
        case 'paying':
            return rows.filter(r => r.counts === undefined || (r.counts !== null && r.counts.schedules > 0))
        default:
            return [...rows]
    }
}

const knownPrice = (p?: BigNumber) => p !== undefined && p.gt(0)

/**
 * "Most staked". Display amounts of different tokens aren't comparable (1 BZE ≠ 1 TOK), so two
 * rows whose USD prices are both known compare by staked USD value; otherwise they fall back to
 * the raw display amount. The fallback keeps tokens without a market sortable.
 */
function compareStaked(a: HolderRow, b: HolderRow): number {
    if (knownPrice(a.usdPrice) && knownPrice(b.usdPrice)) {
        return b.stakedDisplay.multipliedBy(b.usdPrice!).comparedTo(a.stakedDisplay.multipliedBy(a.usdPrice!)) ?? 0
    }
    return b.stakedDisplay.comparedTo(a.stakedDisplay) ?? 0
}

const compareName = (a: HolderRow, b: HolderRow) =>
    a.ticker.localeCompare(b.ticker, 'en', { sensitivity: 'base' }) || a.dr.staking_denom.localeCompare(b.dr.staking_denom)

/**
 * Rows in the chosen order; ties keep the chain order. "Most prize tokens" needs the counts:
 * rows still loading keep their slot, and only the loaded rows (failed ones last) are sorted into
 * the other slots, so nothing jumps around while the counts arrive.
 */
export function sortHolderRows(rows: ReadonlyArray<HolderRow>, sort: HolderSort): HolderRow[] {
    const indexed = rows.map((row, i) => ({ row, i }))
    const stable = (cmp: (a: HolderRow, b: HolderRow) => number) =>
        (x: { row: HolderRow; i: number }, y: { row: HolderRow; i: number }) => cmp(x.row, y.row) || x.i - y.i

    if (sort === 'staked') return indexed.sort(stable(compareStaked)).map(x => x.row)
    if (sort === 'name') return indexed.sort(stable(compareName)).map(x => x.row)

    const prizes = (r: HolderRow) => (r.counts ? r.counts.prizes : -1)
    const sorted = indexed.filter(x => x.row.counts !== undefined).sort(stable((a, b) => prizes(b) - prizes(a)))
    let next = 0
    return indexed.map(x => (x.row.counts === undefined ? x.row : sorted[next++].row))
}
