// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import BigNumber from 'bignumber.js'

// The fee is paid in BZE (no other fee token picked); the wallet's balances are fed directly.
const { balances } = vi.hoisted(() => ({ balances: { current: {} as Record<string, string> } }))

vi.mock('../constants/assets', () => ({ getChainNativeAssetDenom: () => 'ubze' }))
vi.mock('./useTxFeeDenom', () => ({ useTxFeeDenom: () => ({ denom: 'ubze', isLoading: false }) }))
vi.mock('./useLiquidityPools', () => ({ useLiquidityPools: () => ({ getDenomsPool: () => undefined, isLoading: false }) }))
vi.mock('./useFeeTokens', () => ({ useFeeTokens: () => ({ minLiquidity: new BigNumber(0), isLoading: false }) }))
vi.mock('./useAssets', () => ({
    useAsset: (denom: string) => ({
        asset: denom ? { denom, ticker: denom, decimals: 6 } : undefined,
        isLoading: false,
    }),
}))
vi.mock('./useBalances', () => ({
    useBalance: (denom: string) => ({
        balance: { denom, amount: new BigNumber(balances.current[denom] ?? '0') },
        isLoading: false,
    }),
}))

import { useFeeEstimate } from './useFeeEstimate'

// A pool creation on mainnet: 25,000 BZE fee + 2,874,974.309929 BZE starting reserve, from a
// wallet holding 2,884,820.106420 BZE — enough for the fee alone, not for both.
const FEE = { denom: 'ubze', amount: '25000000000' }
const STARTING_BZE = { denom: 'ubze', amount: '2874974309929' }
const GAS = { denom: 'ubze', amount: new BigNumber(9000) }

describe('useFeeEstimate', () => {
    it('reserves the other coins the transaction spends before checking the fee', () => {
        balances.current = { ubze: '2884820106420' }

        const { result } = renderHook(() => useFeeEstimate(FEE, { gasFee: GAS, reserved: [STARTING_BZE] }))

        expect(result.current.method).toBe('insufficient')
    })

    it('passes when the balance covers the fee, the gas and the reserved coins', () => {
        balances.current = { ubze: '2899975000000' }

        const { result } = renderHook(() => useFeeEstimate(FEE, { gasFee: GAS, reserved: [STARTING_BZE] }))

        expect(result.current.method).toBe('native')
    })

    it('ignores reserved coins of other denoms', () => {
        balances.current = { ubze: '25000009000' }

        const { result } = renderHook(() => useFeeEstimate(FEE, { gasFee: GAS, reserved: [{ denom: 'utok', amount: '5' }] }))

        expect(result.current.method).toBe('native')
    })
})
