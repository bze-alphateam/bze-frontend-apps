import {useCallback, useMemo} from "react";
import BigNumber from "bignumber.js";
import {useChain} from "@interchain-kit/react";
import {getChainName, isLpDenom, useAssets, useAssetsValue, useDenomRewardsData} from "@bze/bze-ui-kit";
import {useNativeStakingData} from "@/hooks/useNativeStakingData";
import {useRewardsStakingData} from "@/hooks/useRewardsStakingData";
import {buildStakingRows, type StakingLookups} from "@/lib/staking-list";

/**
 * Every reward as a `StakingRow` (native staking, simple and compounded rewards, with the
 * connected wallet's positions), for /staking and the reward details page.
 */
export function useStakingRows() {
    const {stakingData, isLoading: isLoadingNative, reload: reloadNative} = useNativeStakingData()
    const {rewards: stakingRewards, isLoading: isLoadingStakingRewards, addressData, reload: reloadRewardsStaking} = useRewardsStakingData()
    const {address} = useChain(getChainName())
    const {items: denomRewards, isLoading: isLoadingDenomRewards, hasError: denomRewardsError, reload: reloadDenomRewards} = useDenomRewardsData(address)
    const {isVerifiedAsset, denomTicker, nativeAsset} = useAssets()
    const {denomUsdValue} = useAssetsValue()

    const lookups = useMemo<StakingLookups>(() => ({
        ticker: denomTicker,
        verified: isVerifiedAsset,
        isLp: isLpDenom,
        usdValue: (denom, uAmount) => denomUsdValue(denom, new BigNumber(uAmount)),
    }), [denomTicker, isVerifiedAsset, denomUsdValue]);

    const nativeDenom = nativeAsset?.denom ?? 'ubze';
    const rows = useMemo(() => buildStakingRows({
        native: stakingData,
        nativeDenom,
        simple: stakingRewards,
        addressData,
        compounded: denomRewards,
    }, lookups), [stakingData, nativeDenom, stakingRewards, addressData, denomRewards, lookups]);

    const reload = useCallback(() => {
        reloadNative()
        reloadRewardsStaking()
        reloadDenomRewards()
    }, [reloadNative, reloadRewardsStaking, reloadDenomRewards]);

    return {
        rows,
        lookups,
        nativeDenom,
        address,
        isLoading: isLoadingNative || isLoadingStakingRewards || isLoadingDenomRewards,
        denomRewardsError,
        reloadDenomRewards,
        reload,
    };
}
