import BigNumber from "bignumber.js";
import {StakingRewardParticipantSDKType, StakingRewardSDKType} from "@bze/bzejs/bze/rewards/store";
import {calculateRewardsStakingPendingRewards, removeLeadingZeros} from "@bze/bze-ui-kit";
import type {
    AddressRewardsStaking,
    DenomRewardCoin,
    DenomRewardHolderItem,
    ExtendedPendingUnlockParticipantSDKType,
    NativeStakingData,
} from "@bze/bze-ui-kit";

// Pure list logic for /staking: every reward (native staking, simple and compounded rewards) as
// one row, then the explore filters, the sort and the numbered pages. Asset lookups and prices come
// in as functions, so this file needs no React and no context.

export type RewardKind = 'native' | 'simple' | 'compounded';

/** Native staking pays out only above this many ubze (a smaller claim would cost more than it pays). */
export const NATIVE_MIN_CLAIM_AMOUNT = 100_000;

export const STAKING_PAGE_SIZE = 25;

export interface StakingRowUnlock {
    /** Base units of the staking denom. */
    amount: string;
    /** Hour epoch it unlocks at (simple and compounded rewards). */
    unlockEpoch?: number;
    /** When it unlocks (native staking). */
    unlockTime?: Date;
}

/** The viewer's part in a reward. Amounts are base units. */
export interface StakingRowPosition {
    stake: string;
    /** Share of the pool, in percent. */
    sharePct: number;
    /** What the viewer earns per day at the current pool size (estimate). */
    daily: DenomRewardCoin[];
    /** What a claim would pay now. */
    pending: DenomRewardCoin[];
    /** True when a claim is worth sending (native staking has a minimum). */
    claimable: boolean;
    unlocks: StakingRowUnlock[];
}

export type StakingRowSource =
    | { kind: 'native'; data: NativeStakingData }
    | { kind: 'simple'; reward: StakingRewardSDKType; stake?: StakingRewardParticipantSDKType; unlocking?: ExtendedPendingUnlockParticipantSDKType[] }
    | { kind: 'compounded'; item: DenomRewardHolderItem };

export type StakingRowStatus = 'running' | 'waiting' | 'finished' | 'paying' | 'airdrops' | 'unknown';

export interface StakingRow {
    /** `native`, `simple:<reward id>` or `compounded:<staking denom>`. */
    id: string;
    kind: RewardKind;
    /** The reward's name: "BZE Native Staking", "BZE #14", or the token for a compounded reward. */
    name: string;
    stakingDenom: string;
    isLp: boolean;
    verified: boolean;
    status: StakingRowStatus;
    /** Percent; undefined when it can't be worked out (an unpriced token, an empty pool). */
    apr?: number;
    /** Prize denoms, biggest daily payout first. */
    earn: string[];
    /** What the whole pool is paid per day; undefined when unknown. */
    daily?: DenomRewardCoin[];
    totalStaked: string;
    totalStakedUsd: BigNumber;
    /** Days a stake stays locked after unstaking. */
    lockDays: number;
    /** Base units; '0' = no minimum. */
    minStake: string;
    /** Days paid out of the program's duration (simple rewards only; the others run on). */
    progress?: { done: number; duration: number };
    position?: StakingRowPosition;
    /** Tickers the search matches. */
    searchTerms: string[];
    source: StakingRowSource;
}

/** How the list reads assets and prices; the page passes the ui-kit hooks' functions. */
export interface StakingLookups {
    ticker: (denom: string) => string;
    verified: (denom: string) => boolean;
    isLp: (denom: string) => boolean;
    /** USD value of a base-unit amount; 0 when the denom has no price. */
    usdValue: (denom: string, uAmount: BigNumber.Value) => BigNumber;
}

export interface StakingRowsInput {
    native?: NativeStakingData;
    nativeDenom: string;
    simple: StakingRewardSDKType[];
    addressData?: AddressRewardsStaking;
    compounded: DenomRewardHolderItem[];
}

const bn = (v: BigNumber.Value | undefined) => new BigNumber(v ?? 0);

const sharePct = (stake: BigNumber.Value, total: BigNumber.Value): number => {
    const t = bn(total);
    if (!t.gt(0)) return 0;
    return bn(stake).dividedBy(t).multipliedBy(100).toNumber();
};

const share = (stake: BigNumber.Value, total: BigNumber.Value, amount: BigNumber.Value): string => {
    const t = bn(total);
    if (!t.gt(0)) return '0';
    return bn(stake).dividedBy(t).multipliedBy(amount).integerValue(BigNumber.ROUND_FLOOR).toFixed(0);
};

/** Yearly percent from a daily payout and a pool size in the same unit. */
const aprOf = (daily: BigNumber, staked: BigNumber): number | undefined => {
    if (!staked.gt(0) || !daily.gt(0) || daily.isNaN() || staked.isNaN()) return undefined;
    return daily.dividedBy(staked).multipliedBy(36_500).toNumber();
};

function nativeRow(data: NativeStakingData, denom: string, lk: StakingLookups): StakingRow {
    const total = data.totalStaked.amount;
    const cur = data.currentStaking;
    const staked = cur?.staked.amount ?? bn(0);
    const unbonding = cur?.unbonding.total.amount ?? bn(0);
    const pending = cur?.pendingRewards.total.amount ?? bn(0);
    const apr = Number(data.averageApr);

    let position: StakingRowPosition | undefined;
    if (staked.gt(0) || unbonding.gt(0) || pending.gt(0)) {
        const first = cur?.unbonding.firstUnlock;
        position = {
            stake: staked.toFixed(0),
            sharePct: sharePct(staked, total),
            daily: staked.gt(0) ? [{denom, amount: share(staked, total, data.averageDailyDistribution.amount)}] : [],
            pending: pending.gt(0) ? [{denom, amount: pending.toFixed(0)}] : [],
            claimable: pending.gt(NATIVE_MIN_CLAIM_AMOUNT) && (cur?.pendingRewards.validators.length ?? 0) > 0,
            unlocks: unbonding.gt(0) ? [{amount: unbonding.toFixed(0), unlockTime: first?.unlockTime}] : [],
        };
    }

    return {
        id: 'native',
        kind: 'native',
        name: `${lk.ticker(denom)} Native Staking`,
        stakingDenom: denom,
        isLp: false,
        verified: true,
        status: 'running',
        apr: Number.isFinite(apr) && apr > 0 ? apr : undefined,
        earn: [denom],
        daily: [{denom, amount: data.averageDailyDistribution.amount.toFixed(0)}],
        totalStaked: total.toFixed(0),
        totalStakedUsd: lk.usdValue(denom, total),
        lockDays: Number(data.unlockDuration) || 0,
        minStake: '0',
        position,
        searchTerms: [lk.ticker(denom)],
        source: {kind: 'native', data},
    };
}

function simpleRow(sr: StakingRewardSDKType, addressData: AddressRewardsStaking | undefined, lk: StakingLookups): StakingRow {
    const stake = addressData?.active.get(sr.reward_id);
    const unlocking = addressData?.unlocking.get(sr.reward_id);
    const staked = bn(sr.staked_amount);
    const finished = sr.payouts >= sr.duration;

    let apr: number | undefined;
    if (sr.prize_denom === sr.staking_denom) {
        apr = aprOf(bn(sr.prize_amount), staked);
    } else {
        apr = aprOf(lk.usdValue(sr.prize_denom, sr.prize_amount), lk.usdValue(sr.staking_denom, staked));
    }

    let position: StakingRowPosition | undefined;
    if (stake || (unlocking && unlocking.length > 0)) {
        const pending = stake ? calculateRewardsStakingPendingRewards(sr, stake) : bn(0);
        position = {
            stake: bn(stake?.amount).toFixed(0),
            sharePct: sharePct(stake?.amount ?? 0, staked),
            daily: stake && !finished ? [{denom: sr.prize_denom, amount: share(stake.amount, staked, sr.prize_amount)}] : [],
            pending: pending.gt(0) ? [{denom: sr.prize_denom, amount: pending.toFixed(0)}] : [],
            claimable: pending.gt(0),
            unlocks: (unlocking ?? []).map(u => ({amount: bn(u.amount).toFixed(0), unlockEpoch: u.unlockEpoch.toNumber()})),
        };
    }

    const id = removeLeadingZeros(sr.reward_id);
    return {
        id: `simple:${sr.reward_id}`,
        kind: 'simple',
        name: `${lk.ticker(sr.staking_denom)} #${id}`,
        stakingDenom: sr.staking_denom,
        isLp: lk.isLp(sr.staking_denom),
        verified: lk.verified(sr.staking_denom) && lk.verified(sr.prize_denom),
        status: finished ? 'finished' : staked.gt(0) ? 'running' : 'waiting',
        apr: finished ? undefined : apr,
        earn: [sr.prize_denom],
        daily: [{denom: sr.prize_denom, amount: bn(sr.prize_amount).toFixed(0)}],
        totalStaked: staked.toFixed(0),
        totalStakedUsd: lk.usdValue(sr.staking_denom, staked),
        lockDays: sr.lock,
        minStake: bn(sr.min_stake).toFixed(0),
        progress: {done: sr.payouts, duration: sr.duration},
        position,
        searchTerms: [lk.ticker(sr.staking_denom), lk.ticker(sr.prize_denom), `#${id}`],
        source: {kind: 'simple', reward: sr, stake, unlocking},
    };
}

function compoundedRow(item: DenomRewardHolderItem, lk: StakingLookups): StakingRow {
    const {denomReward, position, dailyPrizes, unlocks} = item;
    const denom = denomReward.staking_denom;
    const staked = bn(denomReward.staked_amount);

    // APR only when every daily prize and the staked token have a price
    let apr: number | undefined;
    if (dailyPrizes && dailyPrizes.length > 0) {
        const values = dailyPrizes.map(p => lk.usdValue(p.denom, p.amount));
        if (values.every(v => v.gt(0))) {
            apr = aprOf(values.reduce((a, b) => a.plus(b), bn(0)), lk.usdValue(denom, staked));
        }
    }

    let rowPosition: StakingRowPosition | undefined;
    if (position || unlocks.length > 0) {
        const stake = position?.participant.amount ?? '0';
        const pending = (position?.pending ?? []).filter(c => bn(c.amount).gt(0));
        rowPosition = {
            stake: bn(stake).toFixed(0),
            sharePct: sharePct(stake, staked),
            daily: position ? (dailyPrizes ?? [])
                .map(p => ({denom: p.denom, amount: share(stake, staked, p.amount)}))
                .filter(c => bn(c.amount).gt(0)) : [],
            pending,
            claimable: pending.length > 0,
            unlocks: unlocks.map(u => ({amount: bn(u.amount).toFixed(0), unlockEpoch: u.unlockEpoch})),
        };
    }

    const prizeDenoms = (dailyPrizes ?? []).map(p => p.denom);
    return {
        id: `compounded:${denom}`,
        kind: 'compounded',
        name: lk.ticker(denom),
        stakingDenom: denom,
        isLp: lk.isLp(denom),
        verified: lk.verified(denom),
        status: dailyPrizes === undefined ? 'unknown' : dailyPrizes.length > 0 ? 'paying' : 'airdrops',
        apr,
        earn: prizeDenoms,
        daily: dailyPrizes,
        totalStaked: staked.toFixed(0),
        totalStakedUsd: lk.usdValue(denom, staked),
        lockDays: denomReward.lock,
        minStake: bn(denomReward.min_stake).toFixed(0),
        position: rowPosition,
        searchTerms: [lk.ticker(denom), ...prizeDenoms.map(lk.ticker), ...(position?.pending ?? []).map(c => lk.ticker(c.denom))],
        source: {kind: 'compounded', item},
    };
}

/** Every reward as a row, in the explore order (see {@link sortStakingRows}). */
export function buildStakingRows(input: StakingRowsInput, lk: StakingLookups): StakingRow[] {
    const rows: StakingRow[] = [];
    if (input.native) rows.push(nativeRow(input.native, input.nativeDenom, lk));
    input.simple.forEach(sr => rows.push(simpleRow(sr, input.addressData, lk)));
    input.compounded.forEach(item => rows.push(compoundedRow(item, lk)));

    return sortStakingRows(rows);
}

const sortRank = (r: StakingRow): number => {
    if (r.kind === 'native') return 0;
    if (r.verified && r.apr !== undefined) return 1;
    if (r.verified) return 2;
    return 3;
};

/**
 * Native staking first, then verified rewards by APR (highest first), then verified rewards
 * without an APR, then the rest; ties by the pool's USD value, then by name.
 */
export function sortStakingRows(rows: readonly StakingRow[]): StakingRow[] {
    return [...rows].sort((a, b) => {
        const byRank = sortRank(a) - sortRank(b);
        if (byRank !== 0) return byRank;
        if (a.apr !== undefined && b.apr !== undefined && a.apr !== b.apr) return b.apr - a.apr;
        const byUsd = b.totalStakedUsd.comparedTo(a.totalStakedUsd) ?? 0;
        if (byUsd !== 0) return byUsd;
        return a.name.localeCompare(b.name);
    });
}

export type StakingKindFilter = 'all' | 'simple' | 'compounded' | 'lp';

export interface StakingFilters {
    search: string;
    kind: StakingKindFilter;
    verifiedOnly: boolean;
    showFinished: boolean;
}

export const DEFAULT_STAKING_FILTERS: StakingFilters = {search: '', kind: 'all', verifiedOnly: true, showFinished: false};

/**
 * The explore list after the search, the kind chip and the two toggles. Keeps the order. Native
 * staking hides while a search is active, so only the matching rewards show (a Factory link
 * searches for one token's rewards).
 */
export function filterStakingRows(rows: readonly StakingRow[], f: StakingFilters): StakingRow[] {
    const term = f.search.trim().toLowerCase();
    return rows.filter(r => {
        if (term && r.kind === 'native') return false;
        if (f.kind === 'lp' ? !r.isLp : f.kind !== 'all' && r.kind !== f.kind) return false;
        if (f.verifiedOnly && !r.verified) return false;
        if (!f.showFinished && r.status === 'finished') return false;
        if (!term) return true;
        return r.name.toLowerCase().includes(term) || r.searchTerms.some(t => t.toLowerCase().includes(term));
    });
}

/** The rows the viewer is in: a stake, something unlocking, or a reward to claim. */
export function positionRows(rows: readonly StakingRow[]): StakingRow[] {
    return rows.filter(r => r.position !== undefined);
}

export interface StakingPage<T> {
    items: T[];
    /** 1-based, clamped to the pages that exist. */
    page: number;
    pageCount: number;
    /** 1-based index of the first item shown, 0 when empty. */
    from: number;
    to: number;
    total: number;
}

export function paginate<T>(items: readonly T[], page: number, size = STAKING_PAGE_SIZE): StakingPage<T> {
    const pageCount = Math.max(1, Math.ceil(items.length / size));
    const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
    const start = (current - 1) * size;
    const slice = items.slice(start, start + size);
    return {
        items: slice,
        page: current,
        pageCount,
        from: slice.length > 0 ? start + 1 : 0,
        to: start + slice.length,
        total: items.length,
    };
}

/**
 * The numbered buttons of a pager: the first and last page, the current one with a neighbour
 * on each side, and `'…'` for the gaps. `[1, '…', 4, 5, 6, '…', 42]`.
 */
export function pageButtons(current: number, pageCount: number): Array<number | '…'> {
    if (pageCount <= 7) return Array.from({length: pageCount}, (_, i) => i + 1);

    const pages = new Set([1, pageCount, current - 1, current, current + 1]);
    if (current <= 3) [2, 3, 4].forEach(p => pages.add(p));
    if (current >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach(p => pages.add(p));

    const sorted = Array.from(pages).filter(p => p >= 1 && p <= pageCount).sort((a, b) => a - b);
    const out: Array<number | '…'> = [];
    sorted.forEach((p, i) => {
        if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
        out.push(p);
    });
    return out;
}

/** Sums coins per denom, in the order each denom first appears. */
export function sumCoins(coins: readonly DenomRewardCoin[]): DenomRewardCoin[] {
    const totals = new Map<string, BigNumber>();
    coins.forEach(c => totals.set(c.denom, (totals.get(c.denom) ?? bn(0)).plus(c.amount)));
    return Array.from(totals.entries()).map(([denom, amount]) => ({denom, amount: amount.toFixed(0)}));
}
