import BigNumber from "bignumber.js";
import {bze} from "@bze/bzejs";
import type {
    StakingRewardParticipantSDKType,
    StakingRewardSDKType,
} from "@bze/bzejs/bze/rewards/store";
import {
    type AddressRewardsStaking,
    calculateRewardsStakingApr,
    calculateRewardsStakingPendingRewards,
    type ExtendedPendingUnlockParticipantSDKType,
    uAmountToBigNumberAmount,
} from "@bze/bze-ui-kit";

const {joinStaking, exitStaking, claimStakingRewards} = bze.rewards.MessageComposer.withTypeUrl;

/** A fixed-term program (x/rewards Staking Reward) with the viewer's part in it. */
export interface FixedTermProgram {
    program: StakingRewardSDKType;
    /** The viewer's stake, when staked. */
    stake?: StakingRewardParticipantSDKType;
    /** The viewer's stakes on their way out of the program. */
    unlocking: ExtendedPendingUnlockParticipantSDKType[];
    /** Prize the viewer can claim, in base units. */
    pending: BigNumber;
}

/** A program has paid every day it was funded for. */
export function isProgramFinished(program: StakingRewardSDKType): boolean {
    return program.payouts >= program.duration;
}

/** Days the program still pays, 0 once finished. */
export function programDaysLeft(program: StakingRewardSDKType): number {
    return Math.max(0, program.duration - program.payouts);
}

/**
 * The fixed-term programs of T (Business Logic R6): the running ones staking T, then the
 * finished ones the viewer still has a stake or an unlock in. Finished programs nobody here
 * is in are left out.
 */
export function fixedTermPrograms(
    rewards: StakingRewardSDKType[],
    denom: string,
    addressData?: AddressRewardsStaking,
): FixedTermProgram[] {
    const running: FixedTermProgram[] = [];
    const finished: FixedTermProgram[] = [];
    for (const program of rewards) {
        if (program.staking_denom !== denom) continue;

        const stake = addressData?.active.get(program.reward_id);
        const unlocking = addressData?.unlocking.get(program.reward_id) ?? [];
        const item = {program, stake, unlocking, pending: calculateRewardsStakingPendingRewards(program, stake)};
        if (!isProgramFinished(program)) {
            running.push(item);
        } else if (stake || unlocking.length > 0) {
            finished.push(item);
        }
    }

    return [...running, ...finished];
}

/** What T is unlocking from a program in total, in base units. */
export function unlockingTotal(unlocking: ExtendedPendingUnlockParticipantSDKType[]): BigNumber {
    return unlocking.reduce((total, unlock) => total.plus(unlock.amount), new BigNumber(0));
}

interface ProgramAprInput {
    program: StakingRewardSDKType;
    stakingDecimals: number;
    prizeDecimals: number;
    /** USD per display unit; 0 or missing means no price. */
    stakingPrice?: BigNumber;
    prizePrice?: BigNumber;
}

/**
 * The program's APR in percent, as the DEX's staking page tells it: daily prize ÷ staked × 365,
 * in base units when it pays in T, in USD otherwise. Undefined when it can't be told: nothing
 * staked, or a price missing for a program paying in another token.
 */
export function programApr({program, stakingDecimals, prizeDecimals, stakingPrice, prizePrice}: ProgramAprInput): BigNumber | undefined {
    let prize = new BigNumber(program.prize_amount);
    let staked = new BigNumber(program.staked_amount);
    if (program.prize_denom !== program.staking_denom) {
        if (!stakingPrice?.gt(0) || !prizePrice?.gt(0)) return undefined;

        staked = uAmountToBigNumberAmount(staked, stakingDecimals).multipliedBy(stakingPrice);
        prize = uAmountToBigNumberAmount(prize, prizeDecimals).multipliedBy(prizePrice);
        if (prize.isNaN() || !prize.gt(0)) return undefined;
    }
    if (staked.isNaN() || !staked.gt(0)) return undefined;

    return calculateRewardsStakingApr(prize, staked);
}

export type ProgramAction = "stake" | "claim" | "unstake";

/** The one message a program action sends; `uAmount` (base units) is what a stake adds. */
export function programMessage(action: ProgramAction, creator: string, rewardId: string, uAmount?: BigNumber) {
    switch (action) {
        case "stake":
            return joinStaking({creator, rewardId, amount: (uAmount ?? new BigNumber(0)).toFixed(0)});
        case "claim":
            return claimStakingRewards({creator, rewardId});
        default:
            return exitStaking({creator, rewardId});
    }
}
