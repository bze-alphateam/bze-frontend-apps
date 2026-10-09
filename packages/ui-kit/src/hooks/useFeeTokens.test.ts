// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

import type { Asset } from '../types/asset'

// The hook derives fee tokens from the pools and assets of the app's context and the user's
// preferred fee denom from settings; all are fed directly.
const { useLiquidityPoolsMock, useAssetsContextMock, useSettingsMock, updatePreferredFeeDenomMock } = vi.hoisted(() => ({
    useLiquidityPoolsMock: vi.fn(),
    useAssetsContextMock: vi.fn(),
    useSettingsMock: vi.fn(),
    updatePreferredFeeDenomMock: vi.fn(),
}))

vi.mock('./useLiquidityPools', () => ({ useLiquidityPools: () => useLiquidityPoolsMock() }))
vi.mock('./useAssets', () => ({ useAssetsContext: () => useAssetsContextMock() }))
vi.mock('./useSettings', () => ({ useSettings: () => useSettingsMock() }))
vi.mock('../query/tradebin_params', () => ({ getTradebinParams: async () => undefined }))
vi.mock('../constants/assets', () => ({ getChainNativeAssetDenom: () => 'ubze' }))

import { useFeeTokens } from './useFeeTokens'

const asset = (denom: string, halted = false): Asset => ({
    type: 'Factory', denom, decimals: 6, name: denom, ticker: denom, logo: '', stable: false, verified: true,
    supply: 1000n, halted,
})

const DEEP = '200000000000'
const pool = (other: string) => ({ id: `${other}_ubze`, base: 'ubze', quote: other, reserve_base: DEEP, reserve_quote: DEEP })

describe('useFeeTokens', () => {
    beforeEach(() => {
        updatePreferredFeeDenomMock.mockReset()
        useLiquidityPoolsMock.mockReturnValue({ pools: [pool('uactive'), pool('uhalted')], isLoading: false })
        useAssetsContextMock.mockReturnValue({
            assetsMap: new Map([['ubze', asset('ubze')], ['uactive', asset('uactive')], ['uhalted', asset('uhalted', true)]]),
            isLoading: false,
        })
        useSettingsMock.mockReturnValue({ feeDenom: 'ubze', updatePreferredFeeDenom: updatePreferredFeeDenomMock })
    })

    it('never offers a halted denom as fee token', () => {
        const { result } = renderHook(() => useFeeTokens())

        expect(result.current.feeTokens.map(t => t.denom)).toEqual(['ubze', 'uactive'])
        expect(result.current.isValidFeeDenom('uhalted')).toBe(false)
        expect(result.current.isValidFeeDenom('uactive')).toBe(true)
    })

    it('moves a user whose preferred fee denom got halted back to BZE', async () => {
        useSettingsMock.mockReturnValue({ feeDenom: 'uhalted', updatePreferredFeeDenom: updatePreferredFeeDenomMock })
        renderHook(() => useFeeTokens())

        await waitFor(() => expect(updatePreferredFeeDenomMock).toHaveBeenCalledWith(undefined))
    })
})
