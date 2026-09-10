'use client'

import { FeeCoin, TxSpec, useFeeEstimate, useGasFeeEstimate } from '@bze/bze-ui-kit'

/**
 * How the chain will charge a creation fee, mirroring the keeper's charging order: when
 * the transaction fee token differs from the fee's native denom, the chain first tries
 * to capture the equivalent amount in that token (and swaps it) — and silently falls
 * back to charging the native denom when the balance is short. The transaction's gas
 * fee is deducted before any of that, so it is reserved from the relevant balance first.
 *
 * - 'native'       — fee token is the fee denom itself; balance covers fee + gas.
 * - 'alt'          — alternative fee token selected and its balance covers the estimated
 *                    converted amount (pool math, swap fee included) + gas.
 * - 'fallback'     — alternative selected but short; native balance covers the fee, so
 *                    the chain will charge native instead.
 * - 'insufficient' — neither balance covers the fee (or the gas itself cannot be paid).
 */
export type FeePaymentMethod = 'native' | 'alt' | 'fallback' | 'insufficient'

/**
 * Thin factory-flavoured view over ui-kit's shared fee engine (`useFeeEstimate`, pool
 * math) plus the gas estimate of `txKind` (`useGasFeeEstimate`). Pass the kind(s) of the
 * message(s) the form will send so the balance check accounts for the gas fee too.
 */
export function useFeePayment(fee?: FeeCoin, txKind?: TxSpec) {
    const gasFee = useGasFeeEstimate(txKind)
    const estimate = useFeeEstimate(fee, { gasFee: txKind ? gasFee.estimate : undefined })

    const method: FeePaymentMethod = estimate.method === 'preferred'
        ? 'alt'
        : (estimate.method ?? 'insufficient')

    return {
        isLoading: estimate.isLoading || gasFee.isLoading,
        isAltSelected: estimate.isPreferredSelected,
        /** Estimated fee in the selected fee token (display units); undefined when the token can't be used. */
        altAmount: estimate.preferredDisplayAmount,
        altBalanceDisplay: estimate.preferredBalanceDisplay,
        nativeAsset: estimate.nativeAsset,
        altAsset: estimate.preferredAsset,
        /** True when the chain will take the fee from the selected (non-native) fee token. */
        paysWithAlt: method === 'alt',
        method,
        /** The fee is payable one way or the other, gas included — safe to submit. */
        canPayFee: Boolean(fee) && method !== 'insufficient',
        /** The gas fee reserved by the check (zero when no `txKind` was given). */
        gasFee,
        /** The raw shared-engine result, for callers that need more detail. */
        estimate,
    }
}
