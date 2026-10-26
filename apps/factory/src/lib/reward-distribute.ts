import BigNumber from 'bignumber.js'
import type { StakingRewardSDKType } from '@bze/bzejs/bze/rewards/store'
import { amountToUAmount } from '@bze/bze-ui-kit'
import { validateAmount } from '@/components/token-wizard/validation'

// Airdrop through a simple reward. MsgDistributeStakingRewards is permissionless: anyone sends a
// one-time amount of the reward's prize token, split right away between everyone staking. The
// chain refuses it when nothing is staked; a finished reward still takes it (its stakers can claim).

type RewardStake = Pick<StakingRewardSDKType, 'staked_amount'>

/** The chain splits by the staked total, so an empty reward can't take a distribution. */
export const hasStakers = (reward: RewardStake) => new BigNumber(reward.staked_amount || 0).gt(0)

export interface DistributeAmount {
    /** The input's own error ('' when it is a valid positive amount). */
    error: string;
    /** The amount in base units, when valid. */
    uAmount?: string;
    /** A valid amount above what can be spent (the balance less the gas when it is the gas token). */
    short: boolean;
}

/** Checks the typed amount against the prize token's decimals and the spendable balance (base units). */
export function checkDistributeAmount(input: string, decimals: number, spendable?: BigNumber.Value): DistributeAmount {
    const error = validateAmount(input, decimals)
    if (error) return { error, short: false }
    const uAmount = amountToUAmount(input.trim(), decimals)
    const short = spendable !== undefined && new BigNumber(spendable).lt(uAmount)
    return { error: '', uAmount, short }
}

/** MsgDistributeStakingRewards' value: the amount in the prize token's base units. */
export const distributeMsgValue = ({ creator, rewardId, uAmount }: { creator: string; rewardId: string; uAmount: string }) =>
    ({ creator, rewardId, amount: uAmount })
