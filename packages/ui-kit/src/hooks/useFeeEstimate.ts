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
import { GasFeeCoin } from '../utils/gas_fee';
import { useAsset } from './useAssets';
import { useBalance } from './useBalances';
import { useFeeTokens } from './useFeeTokens';
import { useLiquidityPools } from './useLiquidityPools';
import { useTxFeeDenom } from './useTxFeeDenom';

export interface UseFeeEstimateOptions {
    /**
     * The transaction's gas fee (from `useGasFeeEstimate`). The ante handler deducts it
     * before the module fee is charged, so it is subtracted from the balance the module
     * fee is checked against. Omit when the gas fee is unknown.
     */
    gasFee?: GasFeeCoin;
}

export interface UseFeeEstimateResult {
    /** Chain-rule estimate for `fee`; undefined while `fee` is unknown. */
    estimate?: FeeEstimate;
    /** Which balance the chain will take the fee from; undefined while `fee` is unknown. */
    method?: FeePaymentMethod;
    /** True when the transaction fee denom differs from the fee's native denom. */
    isPreferredSelected: boolean;
    /** Asset metadata for the fee's own denom (normally the native coin). */
    nativeAsset?: Asset;
    /** Asset metadata for the transaction fee denom (the usable Settings fee token, or BZE). */
    preferredAsset?: Asset;
    /** The fee in display units of `nativeAsset`. */
    nativeDisplayAmount?: BigNumber;
    /** The estimated fee in display units of `preferredAsset`; only when the estimate applies. */
    preferredDisplayAmount?: BigNumber;
    /** The user's native-denom balance in display units. */
    nativeBalanceDisplay: BigNumber;
    /** The user's preferred-denom balance in display units. */
    preferredBalanceDisplay: BigNumber;
    /** The gas fee the balance check accounted for (as passed in). */
    gasFee?: GasFeeCoin;
    /** The gas fee in display units of its own denom, when it was passed in and its asset is known. */
    gasFeeDisplayAmount?: BigNumber;
    /** Ticker of the gas fee denom (falls back to the denom). */
    gasFeeTicker?: string;
    /**
     * The fee the chain will actually take, in the denom it will take it from — ready for
     * `canAffordTx`'s `moduleFee`. Undefined while `fee` is unknown or nothing can cover it.
     */
    resolvedFee?: FeeCoin;
    /** Pools, assets or balances still loading. */
    isLoading: boolean;
}

/**
 * Shared fee engine for the UI: takes a native-denominated fee (trading maker/taker
 * fee, creation fee, …) and tells the caller what the user will really pay, following
 * the chain's charging rules — the transaction fee token first (estimated from the
 * liquidity pool, swap fee included), silent fallback to the native coin otherwise.
 *
 * The "preferred" denom is the one the transaction fee is paid in (`useTxFeeDenom`),
 * because the chain uses the tx fee denom as the preferred denom for every module fee in
 * that transaction. When a `gasFee` is given it is reserved from that balance first.
 *
 * Needs SettingsProvider and the app's assets context (pools, assets, balances) above it.
 */
export function useFeeEstimate(fee?: FeeCoin, options: UseFeeEstimateOptions = {}): UseFeeEstimateResult {
    const { gasFee } = options;
    const nativeDenom = getChainNativeAssetDenom();
    const { denom: feeDenom, isLoading: feeDenomLoading } = useTxFeeDenom();
    const { getDenomsPool, isLoading: poolsLoading } = useLiquidityPools();
    const { minLiquidity, isLoading: feeTokensLoading } = useFeeTokens();

    const feeNativeDenom = fee?.denom ?? nativeDenom;
    const { asset: nativeAsset, isLoading: assetsLoading } = useAsset(feeNativeDenom);
    const { asset: preferredAsset } = useAsset(feeDenom);
    const { asset: gasAsset } = useAsset(gasFee?.denom ?? '');
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
        ? resolveFeePayment(estimate, preferredBalance.amount, nativeBalance.amount, {
            reservedNative: gasFee?.denom === feeNativeDenom ? gasFee.amount : undefined,
            reservedPreferred: gasFee?.denom === feeDenom && feeDenom !== feeNativeDenom ? gasFee.amount : undefined,
        })
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

    const gasFeeDisplayAmount = gasFee && gasAsset
        ? uAmountToBigNumberAmount(gasFee.amount, gasAsset.decimals)
        : undefined;

    let resolvedFee: FeeCoin | undefined;
    if (estimate && method && method !== 'insufficient') {
        resolvedFee = method === 'preferred' && estimate.preferredAmount
            ? { denom: estimate.preferredDenom, amount: estimate.preferredAmount.toFixed(0) }
            : { denom: estimate.nativeDenom, amount: estimate.nativeAmount.toFixed(0) };
    }

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
        gasFee,
        gasFeeDisplayAmount,
        gasFeeTicker: gasFee ? (gasAsset?.ticker ?? gasFee.denom) : undefined,
        resolvedFee,
        isLoading: feeDenomLoading || poolsLoading || feeTokensLoading || assetsLoading || balancesLoading,
    };
}
