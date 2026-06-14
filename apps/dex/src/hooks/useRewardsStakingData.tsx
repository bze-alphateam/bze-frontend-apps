"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import {getAddressStakingRewards, getStakingRewards, getChainName, AddressRewardsStaking} from "@bze/bze-ui-kit";
import {StakingRewardSDKType} from "@bze/bzejs/bze/rewards/store";
import {useChain} from "@interchain-kit/react";

export function useRewardsStakingData() {
    const [isLoading, setIsLoading] = useState(true)
    const [rewardsMap, setRewardsMap] = useState<Map<string, StakingRewardSDKType>>(new Map())
    const [addressData, setAddressData] = useState<AddressRewardsStaking | undefined>()

    const {address} = useChain(getChainName())

    const rewards = useMemo(() =>
            Array.from(rewardsMap.values()).sort((a: StakingRewardSDKType) => a.payouts >= a.duration ? 1 : -1),
        [rewardsMap]
    )

    const fetchStakingRewards = useCallback(async () => {
        const all = await getStakingRewards();
        const newMap = new Map<string, StakingRewardSDKType>();
        all.list.forEach(item => newMap.set(item.reward_id, item));
        setRewardsMap(newMap);
    }, [])

    const fetchAddressRewardsStaking = useCallback(async () => {
        setAddressData(await getAddressStakingRewards(address ?? ''))
    }, [address])

    const load = useCallback(async () => {
        await Promise.all([
            fetchStakingRewards(),
            fetchAddressRewardsStaking(),
        ])

        setIsLoading(false)
    }, [fetchStakingRewards, fetchAddressRewardsStaking])

    useEffect(() => {
        load();
    }, [load])

    return {
        isLoading,
        rewards,
        reload: load,
        addressData,
        rewardsMap,
    }
}
