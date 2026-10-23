import BigNumber from "bignumber.js";

type Num = BigNumber | string | number;

export interface StakeDailyEstimate {
    /** Daily reward of the whole position after the stake: `(existing + add) / (total + add) × daily`. */
    daily: BigNumber;
    /** Daily reward the existing stake earns now: `existing / total × daily` (0 without one). */
    current: BigNumber;
    /** What the stake adds to the daily reward: `daily - current`. */
    gain: BigNumber;
}

/**
 * Estimates a simple reward's daily payout for the user after adding `add` to their stake.
 * `totalStaked` is the reward's `staked_amount`, which already includes the user's
 * `existingStake`. All amounts are in the same unit (micro-amounts on chain); the result is
 * in the prize's unit. Returns null when nothing is being added.
 */
export function estimateStakeDailyRewards(dailyPrize: Num, totalStaked: Num, existingStake: Num, add: Num): StakeDailyEstimate | null {
    const addBN = new BigNumber(add);
    if (addBN.isNaN() || !addBN.gt(0)) return null;

    const prize = new BigNumber(dailyPrize);
    const total = BigNumber.max(new BigNumber(totalStaked), 0);
    // The user's stake is part of the total; never count more than the total as theirs.
    const existing = BigNumber.min(BigNumber.max(new BigNumber(existingStake || 0), 0), total);

    const daily = prize.multipliedBy(existing.plus(addBN)).dividedBy(total.plus(addBN));
    const current = total.gt(0) ? prize.multipliedBy(existing).dividedBy(total) : new BigNumber(0);

    // Never below 0: division rounding must not show a loss.
    return {daily, current, gain: BigNumber.max(daily.minus(current), 0)};
}
