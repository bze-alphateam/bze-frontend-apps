'use client';

import {useCallback, useMemo} from 'react';
import {prettyAmount, uAmountToBigNumberAmount} from '../utils/amount';
import {canAffordTx, CanAffordTxResult, SpendCoin, TxSpec} from '../utils/gas_fee';
import {useAssets} from './useAssets';
import {useBalances} from './useBalances';
import {useGasFeeEstimate, UseGasFeeEstimateResult} from './useGasFeeEstimate';

export interface UseCanAffordTxInput {
    /** What the transaction is made of; undefined = nothing to check yet. */
    spec?: TxSpec;
    /** Coins the transaction itself moves out of the wallet (micro-units). */
    spend?: SpendCoin | SpendCoin[];
    /** A module fee, resolved to the denom the chain will take it in (micro-units). */
    moduleFee?: SpendCoin;
}

export interface UseCanAffordTxResult extends CanAffordTxResult {
    /** The gas fee the check accounted for. */
    gasFee: UseGasFeeEstimateResult;
    /**
     * A ready-to-show reason when `canAfford` is false, e.g. "Not enough BZE left for the
     * network fee (≈ 0.0045 BZE)". Empty when affordable or when nothing is being checked.
     */
    message: string;
    /** Balances, pools or assets still loading. */
    isLoading: boolean;
}

/**
 * Pre-submit affordability of a transaction: the amount(s) it moves, plus the gas fee when
 * it is paid in the same denom, plus an optional module fee — following the chain's
 * charging order (see `canAffordTx`). Drives submit buttons and validation messages.
 */
export function useCanAffordTx({spec, spend, moduleFee}: UseCanAffordTxInput): UseCanAffordTxResult {
    const {getBalanceByDenom, isLoading: balancesLoading} = useBalances();
    const {denomTicker, denomDecimals} = useAssets();
    const gasFee = useGasFeeEstimate(spec);

    const balanceOf = useCallback((denom: string) => getBalanceByDenom(denom).amount, [getBalanceByDenom]);

    // Inline literals are the norm for `spend`/`moduleFee`; key the memo on their content.
    const spendKey = JSON.stringify(spend ?? null, (_, value) => value?._isBigNumber ? value.toString() : value);
    const moduleFeeKey = JSON.stringify(moduleFee ?? null, (_, value) => value?._isBigNumber ? value.toString() : value);

    const result = useMemo<CanAffordTxResult>(() => {
        if (!spec || !gasFee.estimate) {
            return {canAfford: true, shortfalls: [], shortOnFees: false};
        }
        return canAffordTx({spend, gasFee: gasFee.estimate, moduleFee, balanceOf});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spec !== undefined, gasFee.estimate, spendKey, moduleFeeKey, balanceOf]);

    const message = useMemo(() => {
        if (result.canAfford || result.shortfalls.length === 0) {
            return '';
        }
        const worst = result.shortfalls[0];
        const ticker = denomTicker(worst.denom);
        if (result.shortOnFees) {
            const feeDisplay = uAmountToBigNumberAmount(gasFee.amount, denomDecimals(gasFee.denom));
            return `Not enough ${ticker} left for the network fee (≈ ${prettyAmount(feeDisplay)} ${gasFee.ticker})`;
        }
        const missing = uAmountToBigNumberAmount(worst.missing, denomDecimals(worst.denom));
        return `Insufficient ${ticker} balance (${prettyAmount(missing)} ${ticker} short)`;
    }, [result, denomTicker, denomDecimals, gasFee.amount, gasFee.denom, gasFee.ticker]);

    return {
        ...result,
        gasFee,
        message,
        isLoading: balancesLoading || gasFee.isLoading,
    };
}
