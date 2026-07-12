import { useCallback, useEffect, useState } from 'react'
import { getStakingRewards } from '@bze/bze-ui-kit'
import type { StakingRewardSDKType } from '@bze/bzejs/bze/rewards/store'

/**
 * All active staking reward programs, straight from the chain. The store keeps
 * no creator on StakingReward, so there is no "mine" filter — extending a
 * program is permissionless anyway (anyone can fund extra days).
 */
export function useStakingRewards() {
    const [rewards, setRewards] = useState<StakingRewardSDKType[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [reloadCounter, setReloadCounter] = useState(0)

    useEffect(() => {
        let cancelled = false
        getStakingRewards().then(res => {
            if (cancelled) return
            setRewards(res.list)
            setIsLoading(false)
        })

        return () => {
            cancelled = true
        }
    }, [reloadCounter])

    const refresh = useCallback(() => {
        setReloadCounter(counter => counter + 1)
    }, [])

    return { rewards, isLoading, refresh }
}
