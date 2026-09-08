'use client';

import BigNumber from 'bignumber.js';
import { getChainNativeAssetDenom } from '../constants/assets';
import { FeeCoin } from '../types/fees';
import { Asset } from '../types/asset';
import { uAmountToBigNumberAmount } from '../utils/amount';
import {
    estimateFeeInPreferredDenom,
    resolveFeePayment,
    FeeEstimate,
    FeePaymentMethod,
} from '../utils/fee_conversion';
import { useAsset } from './useAssets';
import { useBalance } from './useBalances';
import { useFeeTokens } from './useFeeTokens';
import { useLiquidityPools } from './useLiquidityPools';
import { useSettings } from './useSettings';

export interface UseFeeEstimateResult {
    /** Chain-rule estimate for `fee`; undefined while `fee` is unknown. */
    estimate?: FeeEstimate;
    /** Which balance the chain will take the fee from; undefined while `fee` is unknown. */
    method?: FeePaymentMethod;
    /** True when the Settings fee token differs from the fee's native denom. */
    isPreferredSelected: boolean;
    /** Asset metadata for the fee's own denom (normally the native coin). */
    nativeAsset?: Asset;
    /** Asset metadata for the Settings fee token. */
    preferredAsset?: Asset;
    /** The fee in display units of `nativeAsset`. */
    nativeDisplayAmount?: BigNumber;
    /** The estimated fee in display units of `preferredAsset`; only when the estimate applies. */
    preferredDisplayAmount?: BigNumber;
    /** The user's native-denom balance in display units. */
    nativeBalanceDisplay: BigNumber;
    /** The user's preferred-denom balance in display units. */
    preferredBalanceDisplay: BigNumber;
    /** Pools, assets or balances still loading. */
    isLoading: boolean;
}

/**
 * Shared fee engine for the UI: takes a native-denominated fee (trading maker/taker
 * fee, creation fee, …) and tells the caller what the user will really pay, following
 * the chain's charging rules — the Settings fee token first (estimated from the
 * liquidity pool, swap fee included), silent fallback to the native coin otherwise.
 *
 * Needs SettingsProvider and the app's assets context (pools, assets, balances) above it.
 */
export function useFeeEstimate(fee?: FeeCoin): UseFeeEstimateResult {
    const nativeDenom = getChainNativeAssetDenom();
    const { feeDenom } = useSettings();
    const { getDenomsPool, isLoading: poolsLoading } = useLiquidityPools();
    const { minLiquidity, isLoading: feeTokensLoading } = useFeeTokens();

    const feeNativeDenom = fee?.denom ?? nativeDenom;
    const { asset: nativeAsset, isLoading: assetsLoading } = useAsset(feeNativeDenom);
    const { asset: preferredAsset } = useAsset(feeDenom);
    const { balance: nativeBalance, isLoading: balancesLoading } = useBalance(feeNativeDenom);
    const { balance: preferredBalance } = useBalance(feeDenom);

    const isPreferredSelected = Boolean(feeDenom) && feeDenom !== feeNativeDenom;

    const estimate = fee
        ? estimateFeeInPreferredDenom({
            fee,
            nativeDenom,
            preferredDenom: feeDenom,
            pool: isPreferredSelected ? getDenomsPool(feeDenom, nativeDenom) : undefined,
            minNativeLiquidity: minLiquidity,
        })
        : undefined;

    const method = estimate
        ? resolveFeePayment(estimate, preferredBalance.amount, nativeBalance.amount)
        : undefined;

    const nativeDisplayAmount = estimate && nativeAsset
        ? uAmountToBigNumberAmount(estimate.nativeAmount, nativeAsset.decimals)
        : undefined;

    const preferredDisplayAmount = estimate?.preferredAmount && preferredAsset
        ? uAmountToBigNumberAmount(estimate.preferredAmount, preferredAsset.decimals)
        : undefined;

    const nativeBalanceDisplay = nativeAsset
        ? uAmountToBigNumberAmount(nativeBalance.amount, nativeAsset.decimals)
        : new BigNumber(0);

    const preferredBalanceDisplay = preferredAsset
        ? uAmountToBigNumberAmount(preferredBalance.amount, preferredAsset.decimals)
        : new BigNumber(0);

    return {
        estimate,
        method,
        isPreferredSelected,
        nativeAsset,
        preferredAsset,
        nativeDisplayAmount,
        preferredDisplayAmount,
        nativeBalanceDisplay,
        preferredBalanceDisplay,
        isLoading: poolsLoading || feeTokensLoading || assetsLoading || balancesLoading,
    };
}
