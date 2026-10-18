import { useCallback, useEffect, useState } from 'react'
import { bze } from '@bze/bzejs'
import { PageRequest } from '@bze/bzejs/cosmos/base/query/v1beta1/pagination'
import { getRestClient } from '@bze/bze-ui-kit'
import type { StakingRewardSDKType } from '@bze/bzejs/bze/rewards/store'

export interface StakingRewardsState {
    rewards: StakingRewardSDKType[];
    isLoading: boolean;
    /** The query failed: the list is unknown, not empty. */
    hasError: boolean;
    refresh: () => void;
}

// ui-kit's getStakingRewards() turns a failed query into an empty list, which would show
// "No staking programs yet" while the node is down. Same request (newest first, limit 1000),
// but the error reaches the caller.
async function fetchStakingRewards(): Promise<StakingRewardSDKType[]> {
    const client = await getRestClient()
    const res = await client.bze.rewards.allStakingRewards(bze.rewards.QueryAllStakingRewardsRequest.fromPartial({
        pagination: PageRequest.fromPartial({ reverse: true, limit: BigInt(1000) }),
    }))
    return res.list ?? []
}

/**
 * All staking reward programs, straight from the chain. The store keeps no creator on
 * StakingReward, so there is no "mine" — extending a program is permissionless anyway (anyone
 * can fund extra days). `enabled: false` skips the query, for a caller that passes the list in.
 */
export function useStakingRewards(enabled: boolean = true): StakingRewardsState {
    const [state, setState] = useState<{ rewards: StakingRewardSDKType[]; isLoading: boolean; hasError: boolean }>(
        { rewards: [], isLoading: true, hasError: false },
    )
    const [reloadCounter, setReloadCounter] = useState(0)

    useEffect(() => {
        if (!enabled) return
        let cancelled = false
        fetchStakingRewards()
            .then(rewards => ({ rewards, isLoading: false, hasError: false }))
            .catch(e => {
                console.error('failed to load the staking rewards', e)
                return { rewards: [], isLoading: false, hasError: true }
            })
            .then(next => {
                if (!cancelled) setState(next)
            })

        return () => {
            cancelled = true
        }
    }, [enabled, reloadCounter])

    // A retry after an error shows the skeleton again; a refresh after a tx keeps the rows.
    const refresh = useCallback(() => {
        setState(s => (s.hasError ? { ...s, isLoading: true, hasError: false } : s))
        setReloadCounter(counter => counter + 1)
    }, [])

    return { ...state, refresh }
}
