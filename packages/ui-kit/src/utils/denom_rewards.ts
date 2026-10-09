import BigNumber from "bignumber.js";
import {
    DenomReward,
    DenomRewardCoin,
    DenomRewardPosition,
    DenomRewardSchedule,
    DenomRewardUnlock,
} from "../types/denom_rewards";

/**
 * Pure helpers for the holder side of Denom Rewards (stake / add / claim / exit). Nothing here
 * computes pending prizes: what a claim pays is always the chain's own `pending` field.
 */

/** One DR as a holder sees it: the pool, what it pays per day, and the viewer's stake in it. */
export interface DenomRewardHolderItem {
    denomReward: DenomReward;
    /**
     * What the running schedules pay per day, summed per prize denom; `undefined` when the
     * schedules could not be read (shown as unknown, never as "pays nothing").
     */
    dailyPrizes?: DenomRewardCoin[];
    /** The viewer's position with its claimable coins; `undefined` without one. */
    position?: DenomRewardPosition;
    /** Stakes the viewer exited from this DR that are still locked. */
    unlocks: DenomRewardUnlock[];
}

const DR_UNLOCK_MARKER = 'dr';

/**
 * Splits an index of the shared pending-unlock store. Staking rewards write
 * `<epoch>/<rewardId>/<address>`; denom rewards write `<epoch>/dr/<denom>/<address>`, where the
 * denom may itself contain `/` (factory and IBC denoms). Returns `undefined` for anything else.
 */
export function parsePendingUnlockIndex(index: string):
    | { kind: 'staking-reward'; epoch: number; rewardId: string; address: string }
    | { kind: 'denom-reward'; epoch: number; denom: string; address: string }
    | undefined {
    const parts = index.split('/');
    const epoch = Number(parts[0]);
    if (parts.length < 3 || !Number.isSafeInteger(epoch)) return undefined;

    const address = parts[parts.length - 1];
    if (parts[1] === DR_UNLOCK_MARKER) {
        const denom = parts.slice(2, -1).join('/');
        return denom ? {kind: 'denom-reward', epoch, denom, address} : undefined;
    }

    if (parts.length !== 3) return undefined;
    return {kind: 'staking-reward', epoch, rewardId: parts[1], address};
}

/** What the running schedules pay per day, summed per prize denom (biggest first). */
export function summarizeDailyPrizes(schedules: DenomRewardSchedule[]): DenomRewardCoin[] {
    const totals = new Map<string, BigNumber>();
    for (const s of schedules) {
        if (s.payouts >= s.duration) continue;
        const amount = new BigNumber(s.daily_amount);
        if (!amount.gt(0)) continue;
        totals.set(s.prize_denom, (totals.get(s.prize_denom) ?? new BigNumber(0)).plus(amount));
    }

    return Array.from(totals.entries())
        .sort(([, a], [, b]) => b.comparedTo(a) ?? 0)
        .map(([denom, amount]) => ({denom, amount: amount.toFixed(0)}));
}

/**
 * Estimated daily share of one prize: `stake / totalStaked × dailyAmount`, rounded down. Display
 * only — the chain pays per day from the stakes at payout time. Pass the stake and total AFTER a
 * planned deposit to preview it.
 */
export function estimateDailyShare(
    stake: BigNumber.Value,
    totalStaked: BigNumber.Value,
    dailyAmount: BigNumber.Value,
): BigNumber {
    const total = new BigNumber(totalStaked);
    const mine = new BigNumber(stake);
    if (!total.gt(0) || !mine.gt(0)) return new BigNumber(0);

    return mine.dividedBy(total).multipliedBy(dailyAmount).integerValue(BigNumber.ROUND_FLOOR);
}

/** Why a stake / top-up can't be signed, or '' when it can. Amounts in base units. */
export type DenomRewardStakeProblem = '' | 'invalid' | 'balance' | 'min-stake';

export function validateDenomRewardStake({uAmount, currentStake, minStake, balance}: {
    uAmount?: BigNumber;
    currentStake?: BigNumber.Value;
    minStake: BigNumber.Value;
    balance: BigNumber.Value;
}): DenomRewardStakeProblem {
    if (!uAmount || uAmount.isNaN() || !uAmount.gt(0) || !uAmount.isInteger()) return 'invalid';
    if (uAmount.gt(balance)) return 'balance';
    // the chain checks min_stake on the RESULTING position, so a top-up counts the current stake
    const resulting = uAmount.plus(currentStake ?? 0);
    if (resulting.lt(minStake)) return 'min-stake';

    return '';
}

/** Coins worth paying out: a claim with only zero amounts would just burn the fee. */
export function claimableCoins(position?: DenomRewardPosition): DenomRewardCoin[] {
    return (position?.pending ?? []).filter(c => new BigNumber(c.amount).gt(0));
}

/** Sums the claimable coins of several DRs per prize denom. */
export function sumClaimableCoins(items: DenomRewardHolderItem[]): DenomRewardCoin[] {
    const totals = new Map<string, BigNumber>();
    for (const item of items) {
        for (const c of claimableCoins(item.position)) {
            totals.set(c.denom, (totals.get(c.denom) ?? new BigNumber(0)).plus(c.amount));
        }
    }
    return Array.from(totals.entries()).map(([denom, amount]) => ({denom, amount: amount.toFixed(0)}));
}

/**
 * When a stake exited now comes back: `undefined` for lock 0 (paid back in the exit tx itself),
 * otherwise now + lock days (the chain unlocks at hour epoch now + lock×24).
 */
export function denomRewardUnlockDate(lockDays: number, now: Date = new Date()): Date | undefined {
    if (lockDays <= 0) return undefined;

    return new Date(now.getTime() + lockDays * 24 * 60 * 60 * 1000);
}

/** "in 3 days" / "in 5 hours" / "within the hour" for an unlock at `unlockEpoch` (hour epochs). */
export function formatUnlockCountdown(unlockEpoch: number, currentHourEpoch: number): string {
    const hours = unlockEpoch - currentHourEpoch;
    if (hours <= 1) return 'within the hour';
    if (hours < 48) return `in ${hours} hours`;

    return `in ${Math.floor(hours / 24)} days`;
}

const rank = (item: DenomRewardHolderItem): number => {
    if (item.position) return 0;
    if (item.unlocks.length > 0) return 1;
    if ((item.dailyPrizes?.length ?? 0) > 0) return 2;
    return 3;
};

/**
 * Holder ordering: my positions first, then DRs I'm unlocking from, then DRs that pay daily, and
 * last the ones I'm not in that pay nothing right now; ties by total staked (biggest first).
 */
export function sortDenomRewardItems(items: DenomRewardHolderItem[]): DenomRewardHolderItem[] {
    return [...items].sort((a, b) => {
        const byRank = rank(a) - rank(b);
        if (byRank !== 0) return byRank;

        return new BigNumber(b.denomReward.staked_amount).comparedTo(a.denomReward.staked_amount) ?? 0;
    });
}

/** The holder actions on one denom reward. */
export type DenomRewardAction = 'stake' | 'claim' | 'exit';

/** Why each holder action is unavailable, or '' when it can be opened. */
export function denomRewardActionBlockers({item, hasWallet, balance}: {
    item: DenomRewardHolderItem;
    hasWallet: boolean;
    /** Wallet balance of the staking denom, base units. */
    balance: BigNumber.Value;
}): Record<DenomRewardAction, string> {
    if (!hasWallet) {
        const reason = 'Connect your wallet first.';
        return {stake: reason, claim: reason, exit: reason};
    }

    const {position, denomReward} = item;
    const held = new BigNumber(balance);
    let stake = '';
    if (!held.gt(0)) {
        stake = 'You hold none of this token.';
    } else if (!position && held.lt(denomReward.min_stake)) {
        stake = 'Your balance is below the minimum stake.';
    }

    return {
        stake,
        claim: !position ? 'You have no stake here.' : claimableCoins(position).length === 0 ? 'Nothing to claim yet.' : '',
        exit: !position ? 'You have no stake here.' : '',
    };
}
