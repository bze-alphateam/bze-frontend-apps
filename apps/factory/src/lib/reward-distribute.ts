import BigNumber from 'bignumber.js'
import type { StakingRewardSDKType } from '@bze/bzejs/bze/rewards/store'
import { amountToUAmount } from '@bze/bze-ui-kit'
import { validateAmount } from '@/components/token-wizard/validation'

// Distribute to a simple reward. MsgDistributeStakingRewards is permissionless: anyone sends a
// one-time amount of the reward's prize token, split right away between everyone staking. The
// chain refuses it when nothing is staked; a finished reward still takes it (its stakers can claim).

type RewardStake = Pick<StakingRewardSDKType, 'staked_amount'>
type SearchableReward = RewardStake & Pick<StakingRewardSDKType, 'reward_id' | 'staking_denom' | 'prize_denom'>

export const DISTRIBUTE_PATH = '/reward/distribute'

/** The Distribute wizard for one reward, or its reward list without an id. */
export const distributeHref = (rewardId?: string) =>
    rewardId ? `${DISTRIBUTE_PATH}?id=${encodeURIComponent(rewardId)}` : DISTRIBUTE_PATH

/** The chain splits by the staked total, so an empty reward can't take a distribution. */
export const hasStakers = (reward: RewardStake) => new BigNumber(reward.staked_amount || 0).gt(0)

/** What a link names: `?id=` a reward, `?staking=` / `?denom=` its staked token. */
export interface DistributeLink {
    id?: string | null;
    staking?: string | null;
}

/**
 * The reward a link preselects: `?id=` as given (unknown ids get the not-found page), or the
 * only reward with stakers that stakes the `?staking=` / `?denom=` token. Several matches leave
 * the pick to the list, narrowed to that token.
 */
export function linkedRewardId(rewards: SearchableReward[], link: DistributeLink): string {
    if (link.id) return link.id
    if (!link.staking) return ''
    const matches = rewards.filter(r => r.staking_denom === link.staking && hasStakers(r))
    return matches.length === 1 ? matches[0].reward_id : ''
}

/** Rewards with stakers, narrowed to a staked denom and/or a ticker search, in the chain's order. */
export function searchDistributableRewards<T extends SearchableReward>(
    rewards: T[],
    query: string,
    ticker: (denom: string) => string,
    stakingDenom?: string | null,
): T[] {
    const q = query.trim().toLowerCase()
    return rewards
        .filter(hasStakers)
        .filter(r => !stakingDenom || r.staking_denom === stakingDenom)
        .filter(r => !q || [ticker(r.staking_denom), r.staking_denom, ticker(r.prize_denom)].some(s => s.toLowerCase().includes(q)))
}

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
