'use client'

import { useMemo } from 'react'
import BigNumber from 'bignumber.js'
import {
    FeeCoin,
    toBigNumber,
    uAmountToBigNumberAmount,
    useAsset,
    useAssetPrice,
    useBalance,
    useSettings,
} from '@bze/bze-ui-kit'

/**
 * How the chain will charge a creation fee, mirroring the keeper's
 * CaptureAndSwapUserFee: when the Settings fee token differs from the fee's
 * native denom, the chain first tries to capture the equivalent amount in that
 * token (and swaps it) — and silently falls back to charging the native denom
 * when the balance is short.
 *
 * - 'native'     — fee token is the fee denom itself; balance covers it.
 * - 'alt'        — alternative fee token selected and its balance covers the
 *                  (approximate) converted amount.
 * - 'fallback'   — alternative selected but short; native balance covers the
 *                  fee, so the chain will charge native instead.
 * - 'insufficient' — neither balance covers the fee.
 */
export type FeePaymentMethod = 'native' | 'alt' | 'fallback' | 'insufficient'

export function useFeePayment(fee?: FeeCoin) {
    const { feeDenom } = useSettings()
    const { asset: nativeAsset } = useAsset(fee?.denom ?? '')
    const { asset: altAsset } = useAsset(feeDenom)
    const nativePrice = useAssetPrice(fee?.denom ?? '')
    const altPrice = useAssetPrice(feeDenom)
    const { balance: nativeBalance, isLoading: isNativeLoading } = useBalance(fee?.denom ?? '')
    const { balance: altBalance, isLoading: isAltLoading } = useBalance(feeDenom)

    const isAltSelected = Boolean(fee && altAsset && altAsset.denom !== fee.denom)

    // Approximate fee in the selected fee token (display units), via USD prices.
    // The chain computes the exact swap input from the pool; this is close
    // enough for display and balance checks — the chain's native fallback
    // absorbs any drift.
    const altAmount = useMemo(() => {
        if (!fee || !nativeAsset || !altAsset || !isAltSelected) return undefined
        if (!nativePrice.hasPrice || altPrice.price.isZero()) return undefined
        const usdValue = nativePrice.uAmountUsdValue(toBigNumber(fee.amount), nativeAsset.decimals)
        return usdValue.dividedBy(altPrice.price)
    }, [fee, nativeAsset, altAsset, isAltSelected, nativePrice, altPrice])

    const altBalanceDisplay = useMemo(
        () => (altAsset ? uAmountToBigNumberAmount(altBalance.amount, altAsset.decimals) : new BigNumber(0)),
        [altBalance, altAsset]
    )

    const hasEnoughNative = useMemo(() => {
        if (!fee) return false
        return nativeBalance.amount.gte(fee.amount)
    }, [fee, nativeBalance])

    /** True when the chain will take the fee from the selected (non-native) fee token. */
    const paysWithAlt = useMemo(() => {
        if (!isAltSelected || !altAmount) return false
        return altBalanceDisplay.gte(altAmount)
    }, [isAltSelected, altAmount, altBalanceDisplay])

    const method: FeePaymentMethod = paysWithAlt
        ? 'alt'
        : hasEnoughNative
            ? (isAltSelected ? 'fallback' : 'native')
            : 'insufficient'

    return {
        isLoading: isNativeLoading || isAltLoading,
        isAltSelected,
        /** Approximate fee in the selected fee token (display units); undefined without price data. */
        altAmount,
        altBalanceDisplay,
        nativeAsset,
        altAsset,
        hasEnoughNative,
        paysWithAlt,
        method,
        /** The fee is payable one way or the other — safe to submit. */
        canPayFee: paysWithAlt || hasEnoughNative,
    }
}
