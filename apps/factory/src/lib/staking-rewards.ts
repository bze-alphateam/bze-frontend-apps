import BigNumber from 'bignumber.js'
import type { StakingRewardSDKType } from '@bze/bzejs/bze/rewards/store'

type RewardProgress = Pick<StakingRewardSDKType, 'payouts' | 'duration' | 'staked_amount'>

/**
 * Whether MsgDeleteStakingReward (chain v8.2.0) can remove a program, derived from the queried
 * record only — the keeper checks the same two things in the same order:
 * - `running`: payouts < duration, it still has days to pay (chain error 5013);
 * - `staked`: finished, but stakers have not all exited yet (chain error 5014);
 * - `deletable`: finished and empty — anyone may delete it, nothing is paid or lost.
 */
export type StakingRewardDeletion =
    | { kind: 'running' }
    | { kind: 'staked'; stakedAmount: string }
    | { kind: 'deletable' }

export const isStakingRewardFinished = (reward: Pick<RewardProgress, 'payouts' | 'duration'>) =>
    reward.payouts >= reward.duration

export function stakingRewardDeletion(reward: RewardProgress): StakingRewardDeletion {
    if (!isStakingRewardFinished(reward)) return { kind: 'running' }
    const staked = new BigNumber(reward.staked_amount || 0)
    if (staked.gt(0)) return { kind: 'staked', stakedAmount: reward.staked_amount }
    return { kind: 'deletable' }
}

type PoolSides = { lp_denom: string; base: string; quote: string }

/**
 * Whether a program concerns `denom`: people stake it, earn it, or stake the LP token of a pool
 * that trades it (on either side). Drives the workspace's "Simple rewards with <TICKER>" and
 * the directory's "Programs with your tokens".
 */
export function programInvolves(
    program: Pick<StakingRewardSDKType, 'staking_denom' | 'prize_denom'>,
    denom: string,
    pools: ReadonlyArray<PoolSides>,
): boolean {
    if (program.staking_denom === denom || program.prize_denom === denom) return true
    return pools.some(p => p.lp_denom === program.staking_denom && (p.base === denom || p.quote === denom))
}
