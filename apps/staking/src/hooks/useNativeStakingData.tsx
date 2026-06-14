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
import {ValidatorSDKType, DelegationResponseSDKType, UnbondingDelegationSDKType} from "@bze/bzejs/cosmos/staking/v1beta1/staking";
import {DelegationDelegatorRewardSDKType} from "@bze/bzejs/cosmos/distribution/v1beta1/distribution";

export interface ValidatorWithDelegation {
    validator: ValidatorSDKType;
    delegation?: DelegationResponseSDKType;
    rewards: BigNumber;
}

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

                // Build my validators list. `allValidators` only contains bonded validators (used for
                // the global list and dropdowns), so merge in `delegatorValidators` which includes any
                // jailed/unbonding/unbonded validators the user has delegations with — otherwise those
                // delegations would be silently hidden and users couldn't take action on them.
                const validatorMap = new Map<string, ValidatorSDKType>();
                allValidators.forEach(v => validatorMap.set(v.operator_address, v));
                delegatorValidators.forEach(v => validatorMap.set(v.operator_address, v));

                myValidators = delegations
                    .filter(d => d.delegation && validatorMap.has(d.delegation.validator_address) && new BigNumber(d.balance?.amount ?? '0').gte(1))
                    .map(d => {
                        const valAddr = d.delegation!.validator_address;
                        const rewardEntry = rewards.rewards.find(r => r.validator_address === valAddr);
                        const nativeReward = rewardEntry?.reward.find(r => r.denom === nativeAsset.denom);
                        return {
                            validator: validatorMap.get(valAddr)!,
                            delegation: d,
                            rewards: new BigNumber(nativeReward?.amount ?? "0").integerValue(),
                        };
                    })
                    .sort((a, b) => {
                        const aAmount = new BigNumber(a.delegation?.balance?.amount ?? "0");
                        const bAmount = new BigNumber(b.delegation?.balance?.amount ?? "0");
                        return bAmount.minus(aAmount).toNumber();
                    });
            }

            setFullData({
                stakingData: data,
                allValidators: allValidators.sort((a, b) => {
                    return new BigNumber(b.tokens).minus(new BigNumber(a.tokens)).toNumber();
                }),
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
        if (!isLoadingAssets && nativeAsset) {
            load()
        }
    }, [isLoadingAssets, nativeAsset, load])

    return {
        isLoading,
        reload: load,
        fullData,
    }
}
