'use client';

import {getChainNativeAssetDenom} from '../constants/assets';
import {useFeeTokens} from './useFeeTokens';
import {useSettings} from './useSettings';

export interface UseTxFeeDenomResult {
    /** The denom transactions are actually paid in right now. */
    denom: string;
    /** The chain's native denom. */
    nativeDenom: string;
    /** True when `denom` is the native coin (the Settings fee token is not usable, or is BZE). */
    isNative: boolean;
    /** Pools/assets still loading — `denom` falls back to the native coin meanwhile. */
    isLoading: boolean;
}

/**
 * The denom the transaction fee will really be paid in: the Settings fee token when the
 * chain accepts it (its BZE pool holds enough liquidity — the same `isValidFeeDenom` rule
 * `useTx.simulateFee` applies), the native coin otherwise. Every balance check, MAX button
 * and fee estimate must use this instead of the raw Settings value.
 */
export function useTxFeeDenom(): UseTxFeeDenomResult {
    const nativeDenom = getChainNativeAssetDenom();
    const {feeDenom} = useSettings();
    const {isValidFeeDenom, isLoading} = useFeeTokens();

    const denom = feeDenom && feeDenom !== nativeDenom && isValidFeeDenom(feeDenom) ? feeDenom : nativeDenom;

    return {
        denom,
        nativeDenom,
        isNative: denom === nativeDenom,
        isLoading,
    };
}
