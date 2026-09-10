"use client";

import {useCallback, useEffect, useState} from "react";
import {useChain} from "@interchain-kit/react";
import {
    getChainName, NativeStakingData,
    getAddressNativeDelegatedBalance, getAddressNativeTotalRewards, getAddressUnbondingDelegationsSummary,
    getAnnualProvisions, getDistributionParams, getStakingParams, getStakingPool,
    calcNativeStakingApr, parseUnbondingDays,
    useAssets,
    getValidators, getDelegatorValidators, getDelegatorDelegations, getAddressUnbondingDelegations, getAddressRewards,
} from "@bze/bze-ui-kit";
import BigNumber from "bignumber.js";
import {ValidatorSDKType, UnbondingDelegationSDKType} from "@bze/bzejs/cosmos/staking/v1beta1/staking";
import {DelegationDelegatorRewardSDKType} from "@bze/bzejs/cosmos/distribution/v1beta1/distribution";
import {buildMyValidators, type ValidatorWithDelegation} from "@/lib/my-validators";
import {sortValidatorsByTokens} from "@/lib/validator-list";

export type {ValidatorWithDelegation};

export interface StakingFullData {
    stakingData: NativeStakingData;
    allValidators: ValidatorSDKType[];
    myValidators: ValidatorWithDelegation[];
    unbondingDelegations: UnbondingDelegationSDKType[];
    validatorRewards: DelegationDelegatorRewardSDKType[];
}

export function useNativeStakingData() {
    const [isLoading, setIsLoading] = useState(true)
    const [fullData, setFullData] = useState<StakingFullData|undefined>()
    const {address} = useChain(getChainName())
    const {nativeAsset, isLoading: isLoadingAssets} = useAssets()

    const load = useCallback(async () => {
        if (isLoadingAssets || !nativeAsset) {
            return;
        }

        try {
            const [
                annualProvisions,
                distrParams,
                stakingPool,
                stakingParams,
                allValidators,
            ] = await Promise.all([
                getAnnualProvisions(),
                getDistributionParams(),
                getStakingPool(),
                getStakingParams(),
                getValidators(),
            ])

            const apr = calcNativeStakingApr(stakingPool, distrParams.community_tax, annualProvisions)
            const data: NativeStakingData = {
                averageApr: apr,
                unlockDuration: parseUnbondingDays(stakingParams.unbonding_time as string),
                totalStaked: {
                    amount: new BigNumber(stakingPool.bonded_tokens),
                    denom: nativeAsset.denom
                },
                minAmount: {
                    amount: new BigNumber(0),
                    denom: nativeAsset.denom
                },
                averageDailyDistribution: {
                    amount: annualProvisions.dividedBy(365),
                    denom: nativeAsset.denom
                },
            }

            let myValidators: ValidatorWithDelegation[] = [];
            let unbondingDelegations: UnbondingDelegationSDKType[] = [];
            let validatorRewards: DelegationDelegatorRewardSDKType[] = [];

            if (address) {
                const [
                    delegations,
                    delegatorValidators,
                    totalRewards,
                    unbonding,
                    rewards,
                ] = await Promise.all([
                    getDelegatorDelegations(address),
                    getDelegatorValidators(address),
                    getAddressNativeTotalRewards(address),
                    getAddressUnbondingDelegations(address),
                    getAddressRewards(address),
                ])

                data.currentStaking = {
                    staked: await getAddressNativeDelegatedBalance(address),
                    unbonding: await getAddressUnbondingDelegationsSummary(address),
                    pendingRewards: totalRewards,
                }

                unbondingDelegations = unbonding;
                validatorRewards = rewards.rewards;

                // Merge the bonded global list with the delegator's own validators so
                // jailed/unbonding validators the user still has stake with stay visible.
                myValidators = buildMyValidators({
                    allValidators,
                    delegatorValidators,
                    delegations,
                    rewards: rewards.rewards,
                    nativeDenom: nativeAsset.denom,
                });
            }

            setFullData({
                stakingData: data,
                allValidators: sortValidatorsByTokens(allValidators),
                myValidators,
                unbondingDelegations,
                validatorRewards,
            })
        } catch (error) {
            console.error("Failed to load staking data:", error)
        } finally {
            setIsLoading(false)
        }
    }, [isLoadingAssets, nativeAsset, address])

    useEffect(() => {
        if (isLoadingAssets || !nativeAsset) {
            return
        }
        const run = async () => {
            await load()
        }
        run()
    }, [isLoadingAssets, nativeAsset, load])

    return {
        isLoading,
        reload: load,
        fullData,
    }
}
