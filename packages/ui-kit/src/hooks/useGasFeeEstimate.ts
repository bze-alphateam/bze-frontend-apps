'use client';

import BigNumber from 'bignumber.js';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {getChainNativeAssetDenom} from '../constants/assets';
import {getForeignFeeSlippage, getGasMultiplier, getGasPrice, getNonNativeGasMultiplier} from '../constants/chain';
import {getTxFeeCollectorParams} from '../query/txfeecollector_params';
import {Asset} from '../types/asset';
import {uAmountToBigNumberAmount} from '../utils/amount';
import {estimateGasFee, GasFeeEstimate, resolveGasPrice, TxSpec} from '../utils/gas_fee';
import {useAsset} from './useAssets';
import {useFeeTokens} from './useFeeTokens';
import {useLiquidityPools} from './useLiquidityPools';
import {useTxFeeDenom} from './useTxFeeDenom';

/**
 * The gas price `useTx.simulateFee` will use: the chain's `validator_min_gas_fee` param
 * (fetched once, cached by the query layer) with the env/default price as fallback.
 */
export function useGasPrice(): number {
    const nativeDenom = getChainNativeAssetDenom();
    const fallback = getGasPrice();
    const [gasPrice, setGasPrice] = useState<number>(fallback);

    useEffect(() => {
        let cancelled = false;
        getTxFeeCollectorParams().then(params => {
            if (cancelled) return;
            setGasPrice(resolveGasPrice(params?.validatorMinGasFee, nativeDenom, fallback));
        });
        return () => { cancelled = true; };
    }, [nativeDenom, fallback]);

    return gasPrice;
}

export interface UseGasFeeEstimatorResult {
    /** Estimate the gas fee of any transaction shape with the current chain data. */
    estimate: (spec: TxSpec) => GasFeeEstimate;
    /** The denom estimates are made in (see `useTxFeeDenom`). */
    denom: string;
    /** Asset metadata of `denom`, when known. */
    asset?: Asset;
    /** Pools, fee tokens or assets still loading. */
    isLoading: boolean;
}

/**
 * Gas fee estimator bound to the live chain data (fee denom, gas price, pools). Use it when
 * the transaction shape is only known at submit time (e.g. how many orders a fill touches);
 * for a fixed shape prefer {@link useGasFeeEstimate}.
 */
export function useGasFeeEstimator(): UseGasFeeEstimatorResult {
    const nativeDenom = getChainNativeAssetDenom();
    const {denom: txFeeDenom, isLoading: feeDenomLoading} = useTxFeeDenom();
    const {getDenomsPool, isLoading: poolsLoading} = useLiquidityPools();
    const {minLiquidity} = useFeeTokens();
    const {asset, isLoading: assetsLoading} = useAsset(txFeeDenom);
    const gasPrice = useGasPrice();

    const pool = txFeeDenom !== nativeDenom ? getDenomsPool(txFeeDenom, nativeDenom) : undefined;

    const estimate = useCallback((spec: TxSpec) => estimateGasFee({
        spec,
        nativeDenom,
        txFeeDenom,
        gasPrice,
        gasMultiplier: getGasMultiplier(),
        nonNativeGasMultiplier: getNonNativeGasMultiplier(),
        foreignFeeSlippage: getForeignFeeSlippage(),
        pool,
        minNativeLiquidity: minLiquidity,
    }), [nativeDenom, txFeeDenom, gasPrice, pool, minLiquidity]);

    return {
        estimate,
        denom: txFeeDenom,
        asset,
        isLoading: feeDenomLoading || poolsLoading || assetsLoading,
    };
}

export interface UseGasFeeEstimateResult {
    /** Denom the gas fee is charged in. */
    denom: string;
    /** Gas fee in micro-units of `denom`. Zero when `spec` is undefined. */
    amount: BigNumber;
    /** Gas fee in display units of `denom` (0 while the asset is unknown). */
    displayAmount: BigNumber;
    /** Ticker of `denom`, falling back to the denom itself. */
    ticker: string;
    /** Asset metadata of `denom`, when known. */
    asset?: Asset;
    /** The full estimate (gas limit, native equivalent), undefined when `spec` is undefined. */
    estimate?: GasFeeEstimate;
    /** True when the fee is charged in the native coin. */
    isNative: boolean;
    /** Pools, fee tokens or assets still loading. */
    isLoading: boolean;
}

/**
 * Pre-submit gas fee estimate for a transaction shape (`'send'`, `{kind: 'fill-orders',
 * count: 3}`, `['create-denom', 'mint']`, …). Pass `undefined` when there is nothing to
 * estimate yet — the result is then a zero fee in the current fee denom.
 *
 * Needs SettingsProvider and the app's assets context above it.
 */
export function useGasFeeEstimate(spec?: TxSpec): UseGasFeeEstimateResult {
    const {estimate: estimateFor, denom, asset, isLoading} = useGasFeeEstimator();

    // `spec` is usually an inline literal; key the memo on its content, not its identity.
    const specKey = JSON.stringify(spec ?? null);
    const estimate = useMemo(
        () => spec === undefined ? undefined : estimateFor(spec),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [estimateFor, specKey],
    );

    const amount = estimate?.amount ?? new BigNumber(0);
    const displayAmount = asset ? uAmountToBigNumberAmount(amount, asset.decimals) : new BigNumber(0);

    return {
        denom: estimate?.denom ?? denom,
        amount,
        displayAmount,
        ticker: asset?.ticker ?? denom,
        asset,
        estimate,
        isNative: estimate?.isNative ?? denom === getChainNativeAssetDenom(),
        isLoading,
    };
}
