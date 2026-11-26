'use client';

import BigNumber from 'bignumber.js';
import { useEffect, useState } from 'react';
import { getDenomConfig } from '../query/denom_config';
import { getChainNativeAssetDenom } from '../constants/assets';
import { FeeCoin } from '../types/fees';
import { Asset } from '../types/asset';
import { uAmountToBigNumberAmount } from '../utils/amount';
import {
    estimateFeeInPreferredDenom,
    maxSpendFeeReserve,
    preferredTotal,
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
    /**
     * Other coins the same transaction spends besides the fee (a pool's starting reserves,
     * a reward's budget…). They leave the wallet too, so they are reserved from the native
     * and preferred balances before the fee is checked.
     */
    reserved?: FeeCoin[];
    /**
     * Coins the same transaction pays into the wallet before the fee is captured (a swap's
     * minimum output: tradebin sends it before taking the taker fee). They count toward the
     * native and preferred balances after `reserved` and the gas fee have left.
     */
    received?: FeeCoin[];
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
    /**
     * The full amount the chain takes in `preferredAsset` (display units): the converted fee plus the
     * token's transfer fee (`estimate.preferredTransferFee`); only when the estimate applies.
     */
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
     * `canAffordTx`'s `moduleFee`. When nothing covers it (`insufficient`) it is the native fee,
     * the chain's last resort, so balance checks refuse and MAX holds it back instead of
     * dropping it. Undefined while `fee` is unknown.
     */
    resolvedFee?: FeeCoin;
    /**
     * The fee a MAX of `denom` must leave behind when the message moves the spent coins before
     * capturing its fee (a swap) — see `maxSpendFeeReserve`. Pass it as `useMaxSpendable`'s
     * `moduleFee`. Only the gas fee is reserved besides the spend; `reserved`/`received` are ignored.
     */
    maxSpendReserve: (denom: string) => FeeCoin | undefined;
    /** Pools, assets or balances still loading. */
    isLoading: boolean;
}

/**
 * The preferred token's DenomConfig transfer fee. Zero (and no request, not loading) when the
 * hook is disabled; loading until the config of the current denom has settled. A failed
 * read settles at zero.
 */
function useTransferFee(denom: string, enabled: boolean): { fee: BigNumber; isLoading: boolean } {
    const [loaded, setLoaded] = useState<{ denom: string; fee: BigNumber }>();

    useEffect(() => {
        if (!enabled || !denom) return;
        let cancelled = false;
        getDenomConfig(denom)
            .then(config => config.transferFee)
            .catch(() => new BigNumber(0))
            .then(fee => {
                if (!cancelled) setLoaded({ denom, fee });
            });
        return () => { cancelled = true; };
    }, [denom, enabled]);

    if (!enabled || !denom) return { fee: new BigNumber(0), isLoading: false };
    const settled = loaded?.denom === denom;
    return { fee: settled ? loaded.fee : new BigNumber(0), isLoading: !settled };
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
    const { gasFee, reserved = [], received = [] } = options;
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

    const { fee: transferFee, isLoading: transferFeeLoading } = useTransferFee(feeDenom, isPreferredSelected && feeDenom.startsWith('factory/'));

    const estimate = fee
        ? estimateFeeInPreferredDenom({
            fee,
            nativeDenom,
            preferredDenom: feeDenom,
            pool: isPreferredSelected ? getDenomsPool(feeDenom, nativeDenom) : undefined,
            minNativeLiquidity: minLiquidity,
            transferFee,
        })
        : undefined;

    const sumIn = (coins: GasFeeCoin[], denom: string) => coins
        .filter(coin => coin.denom === denom)
        .reduce((sum, coin) => sum.plus(coin.amount), new BigNumber(0));
    const gasCoins = gasFee ? [gasFee] : [];
    const spent = [...reserved, ...gasCoins];

    // The transfer fee decides the method and the amount: until it is known, report neither.
    const method = estimate && !transferFeeLoading
        ? resolveFeePayment(estimate, preferredBalance.amount, nativeBalance.amount, {
            reservedNative: sumIn(spent, feeNativeDenom),
            reservedPreferred: isPreferredSelected ? sumIn(spent, feeDenom) : undefined,
            receivedNative: sumIn(received, feeNativeDenom),
            receivedPreferred: isPreferredSelected ? sumIn(received, feeDenom) : undefined,
        })
        : undefined;

    const maxSpendReserve = (denom: string) => estimate && denom && !transferFeeLoading
        ? maxSpendFeeReserve(estimate, denom, preferredBalance.amount, nativeBalance.amount, {
            reservedNative: sumIn(gasCoins, feeNativeDenom),
            reservedPreferred: isPreferredSelected ? sumIn(gasCoins, feeDenom) : undefined,
        })
        : undefined;

    const nativeDisplayAmount = estimate && nativeAsset
        ? uAmountToBigNumberAmount(estimate.nativeAmount, nativeAsset.decimals)
        : undefined;

    // The full amount the chain takes in the preferred token: the converted fee plus its transfer fee.
    const preferredTotalAmount = estimate && !transferFeeLoading ? preferredTotal(estimate) : undefined;
    const preferredDisplayAmount = preferredTotalAmount && preferredAsset
        ? uAmountToBigNumberAmount(preferredTotalAmount, preferredAsset.decimals)
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
    if (estimate && method) {
        resolvedFee = method === 'preferred' && preferredTotalAmount
            ? { denom: estimate.preferredDenom, amount: preferredTotalAmount.toFixed(0) }
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
        maxSpendReserve,
        isLoading: feeDenomLoading || poolsLoading || feeTokensLoading || assetsLoading || balancesLoading || transferFeeLoading,
    };
}
