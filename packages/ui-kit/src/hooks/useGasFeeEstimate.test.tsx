// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import BigNumber from 'bignumber.js'
import type { LiquidityPoolSDKType } from '@bze/bzejs/bze/tradebin/store'

// Chain data hooks are fed directly; the denom config is the only thing the test drives.
const { denomConfigMock, feeDenom, txFeeParamsMock } = vi.hoisted(() => ({
    denomConfigMock: vi.fn(),
    feeDenom: { value: 'factory/bze1creator/utoken' },
    txFeeParamsMock: vi.fn(),
}))

vi.mock('../query/denom_config', () => ({ getDenomConfig: denomConfigMock }))
vi.mock('../query/txfeecollector_params', () => ({ getTxFeeCollectorParams: txFeeParamsMock }))
vi.mock('./useTxFeeDenom', () => ({ useTxFeeDenom: () => ({ denom: feeDenom.value, isLoading: false }) }))
vi.mock('./useFeeTokens', () => ({ useFeeTokens: () => ({ minLiquidity: 0 }) }))
vi.mock('./useAssets', () => ({ useAsset: () => ({ asset: undefined, isLoading: false }) }))

const NATIVE = 'ubze'
const pool = (quote: string) => ({
    base: NATIVE,
    quote,
    fee: '0.003',
    reserve_base: '1000000000000',
    reserve_quote: '10000000000',
}) as LiquidityPoolSDKType
vi.mock('./useLiquidityPools', () => ({
    useLiquidityPools: () => ({ getDenomsPool: (denom: string) => pool(denom), isLoading: false }),
}))

import { useGasFeeEstimator } from './useGasFeeEstimate'

const FIRST = 'factory/bze1creator/utoken'
const SECOND = 'factory/bze1creator/uother'
const deferred = <T,>() => {
    let resolve!: (v: T) => void
    const promise = new Promise<T>(r => { resolve = r })
    return { promise, resolve }
}
const config = (gasSurcharge: number) => ({ gasSurcharge: new BigNumber(gasSurcharge), transferFee: new BigNumber(0) })

describe('useGasFeeEstimator gas surcharge', () => {
    beforeEach(() => {
        denomConfigMock.mockReset()
        txFeeParamsMock.mockReset().mockResolvedValue(undefined)
        feeDenom.value = FIRST
    })

    it('is loading until the surcharge is in, then estimates with it', async () => {
        const pending = deferred<ReturnType<typeof config>>()
        denomConfigMock.mockReturnValue(pending.promise)

        const { result } = renderHook(() => useGasFeeEstimator())
        expect(result.current.isLoading).toBe(true)
        const withoutSurcharge = result.current.estimate('send').amount

        pending.resolve(config(0.5))
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        const withSurcharge = result.current.estimate('send').amount
        expect(withSurcharge.gt(withoutSurcharge)).toBe(true)
        // ×1.5 on the converted fee (rounding up can add a unit)
        expect(withSurcharge.toNumber()).toBeGreaterThanOrEqual(Math.ceil(withoutSurcharge.toNumber() * 1.5) - 1)
    })

    it('does not reuse the surcharge of the previous denom', async () => {
        denomConfigMock.mockImplementation(async (denom: string) => config(denom === FIRST ? 2 : 0))
        const { result, rerender } = renderHook(() => useGasFeeEstimator())
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        const surcharged = result.current.estimate('send').amount

        const pending = deferred<ReturnType<typeof config>>()
        denomConfigMock.mockReturnValue(pending.promise)
        feeDenom.value = SECOND
        rerender()

        // new denom, config not in yet: loading, and the old ×3 is not applied
        expect(result.current.isLoading).toBe(true)
        expect(result.current.estimate('send').amount.lt(surcharged)).toBe(true)

        pending.resolve(config(0))
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.estimate('send').amount.lt(surcharged)).toBe(true)
    })
})
