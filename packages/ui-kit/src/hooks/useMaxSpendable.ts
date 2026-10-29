'use client';

import BigNumber from 'bignumber.js';
import {useMemo} from 'react';
import {Asset} from '../types/asset';
import {uAmountToBigNumberAmount} from '../utils/amount';
import {maxSpendableAmount, SpendCoin, TxSpec} from '../utils/gas_fee';
import {useAsset} from './useAssets';
import {useBalance} from './useBalances';
import {useGasFeeEstimate, UseGasFeeEstimateResult} from './useGasFeeEstimate';

export interface UseMaxSpendableResult {
    /** Micro-amount a MAX button may fill in. */
    amount: BigNumber;
    /** `amount` in display units of the asset (0 while the asset is unknown). */
    displayAmount: BigNumber;
    /** `displayAmount` as a string ready for an input (`toFixed()`, never exponential). */
    inputValue: string;
    /** The wallet balance of `denom` (micro-units), before any reserve. */
    balance: BigNumber;
    /** Micro-amount held back for the gas fee and the module fee paid in `denom` (0 when neither is). */
    reserved: BigNumber;
    /** True when part of the balance is being held back for fees. */
    isReserving: boolean;
    /** The gas fee estimate the reserve comes from. */
    gasFee: UseGasFeeEstimateResult;
    /** Asset metadata of `denom`, when known. */
    asset?: Asset;
    /** Balances, pools or assets still loading. */
    isLoading: boolean;
}

export interface UseMaxSpendableOptions {
    /**
     * The module fee the transaction pays (taker fee, creation fee…), resolved to the denom
     * the chain will take it in (`useFeeEstimate`'s `resolvedFee`). Held back too when it is
     * paid in `denom`, so MAX fills what `useCanAffordTx` with the same `moduleFee` accepts.
     */
    moduleFee?: SpendCoin;
}

/**
 * How much of `denom` the user can put into a transaction of shape `spec`: the full
 * balance, minus the estimated gas fee and the module fee, each when it is paid in `denom`
 * (floored at 0). Every MAX / ALL / 100 % button goes through this.
 */
export function useMaxSpendable(denom: string, spec?: TxSpec, options: UseMaxSpendableOptions = {}): UseMaxSpendableResult {
    const {moduleFee} = options;
    const {balance, isLoading: balanceLoading} = useBalance(denom);
    const {asset} = useAsset(denom);
    const gasFee = useGasFeeEstimate(spec);

    const moduleFeeDenom = moduleFee?.denom;
    const moduleFeeAmount = moduleFee?.amount.toString();
    const amount = useMemo(
        () => maxSpendableAmount(
            balance.amount,
            denom,
            gasFee.estimate,
            moduleFeeDenom && moduleFeeAmount ? {denom: moduleFeeDenom, amount: moduleFeeAmount} : undefined,
        ),
        [balance.amount, denom, gasFee.estimate, moduleFeeDenom, moduleFeeAmount],
    );
    const reserved = balance.amount.minus(amount);
    const displayAmount = asset ? uAmountToBigNumberAmount(amount, asset.decimals) : new BigNumber(0);

    return {
        amount,
        displayAmount,
        inputValue: displayAmount.toFixed(),
        balance: balance.amount,
        reserved: reserved.gt(0) ? reserved : new BigNumber(0),
        isReserving: reserved.gt(0),
        gasFee,
        asset,
        isLoading: balanceLoading || gasFee.isLoading,
    };
}
