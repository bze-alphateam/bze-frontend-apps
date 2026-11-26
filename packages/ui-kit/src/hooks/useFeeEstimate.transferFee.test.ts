// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import BigNumber from 'bignumber.js'

const TOK = 'factory/bze1creator/utok'
// Pool 1:1 with 1e12 reserves and no swap fee: a 1,000,000 ubze fee costs ceil(1e6 / (1 - 1e-6)) = 1,000,002 TOK.
const POOL = { base: TOK, quote: 'ubze', fee: '0', reserve_base: '1000000000000', reserve_quote: '1000000000000' }
const FEE = { denom: 'ubze', amount: '1000000' }
const X = 1000002 // converted fee in TOK
const TRANSFER = 50001 // ceil(X * 0.05)

const { state, getDenomConfigMock } = vi.hoisted(() => ({
    state: { feeDenom: '', balances: {} as Record<string, string> },
    getDenomConfigMock: vi.fn(),
}))

vi.mock('../constants/assets', () => ({ getChainNativeAssetDenom: () => 'ubze' }))
vi.mock('./useTxFeeDenom', () => ({ useTxFeeDenom: () => ({ denom: state.feeDenom, isLoading: false }) }))
vi.mock('./useLiquidityPools', () => ({ useLiquidityPools: () => ({ getDenomsPool: () => POOL, isLoading: false }) }))
vi.mock('./useFeeTokens', () => ({ useFeeTokens: () => ({ minLiquidity: new BigNumber(0), isLoading: false }) }))
vi.mock('./useAssets', () => ({
    useAsset: (denom: string) => ({ asset: denom ? { denom, ticker: denom, decimals: 6 } : undefined, isLoading: false }),
}))
vi.mock('./useBalances', () => ({
    useBalance: (denom: string) => ({
        balance: { denom, amount: new BigNumber(state.balances[denom] ?? '0') },
        isLoading: false,
    }),
}))
vi.mock('../query/denom_config', () => ({ getDenomConfig: getDenomConfigMock }))

import { useFeeEstimate } from './useFeeEstimate'

const config = (transferFee: string) =>
    getDenomConfigMock.mockResolvedValue({ gasSurcharge: new BigNumber(0), transferFee: new BigNumber(transferFee) })

const render = () => renderHook(() => useFeeEstimate(FEE))

describe('useFeeEstimate transfer fee', () => {
    beforeEach(() => {
        getDenomConfigMock.mockReset()
        state.feeDenom = TOK
        state.balances = { ubze: '5000000', [TOK]: '999999999999' }
    })

    it('with a zero transfer fee gives the plain converted fee (v8.2.0 reads zeros)', async () => {
        config('0')
        const { result } = render()
        await waitFor(() => expect(getDenomConfigMock).toHaveBeenCalledWith(TOK))

        expect(result.current.method).toBe('preferred')
        expect(result.current.estimate?.preferredAmount?.toFixed(0)).toBe(String(X))
        expect(result.current.estimate?.preferredTransferFee?.toFixed(0)).toBe('0')
        expect(result.current.preferredDisplayAmount?.toFixed()).toBe('1.000002')
        expect(result.current.resolvedFee).toEqual({ denom: TOK, amount: String(X) })
    })

    it('adds ceil(x * 0.05) to the amount and to the resolved fee', async () => {
        config('0.05')
        const { result } = render()

        await waitFor(() => expect(result.current.estimate?.preferredTransferFee?.toFixed(0)).toBe(String(TRANSFER)))
        expect(result.current.estimate?.preferredAmount?.toFixed(0)).toBe(String(X))
        expect(result.current.preferredDisplayAmount?.toFixed()).toBe(new BigNumber(X + TRANSFER).shiftedBy(-6).toFixed())
        expect(result.current.resolvedFee).toEqual({ denom: TOK, amount: String(X + TRANSFER) })
        expect(result.current.method).toBe('preferred')
    })

    it('predicts the fallback when the balance covers x but not x + transfer fee', async () => {
        config('0.05')
        state.balances = { ubze: '5000000', [TOK]: String(X + TRANSFER - 1) }
        const { result } = render()

        await waitFor(() => expect(result.current.method).toBe('fallback'))
        expect(result.current.resolvedFee).toEqual(FEE)
    })

    it('keeps the preferred path when the balance covers exactly x + transfer fee', async () => {
        config('0.05')
        state.balances = { ubze: '5000000', [TOK]: String(X + TRANSFER) }
        const { result } = render()

        await waitFor(() => expect(result.current.estimate?.preferredTransferFee?.toFixed(0)).toBe(String(TRANSFER)))
        expect(result.current.method).toBe('preferred')
    })

    it('reserves the full amount, transfer fee included, when a MAX spends the preferred token', async () => {
        config('0.05')
        // No BZE to fall back on: the fee has to come out of what a MAX of TOK leaves behind.
        state.balances = { ubze: '0', [TOK]: String(X + TRANSFER) }
        const { result } = render()

        await waitFor(() => expect(result.current.estimate?.preferredTransferFee?.toFixed(0)).toBe(String(TRANSFER)))
        expect(result.current.maxSpendReserve(TOK)).toEqual({ denom: TOK, amount: String(X + TRANSFER) })
    })

    it('makes no config request for a non-factory preferred denom', () => {
        state.feeDenom = 'ibc/ABC'
        render()
        state.feeDenom = 'ubze'
        render()

        expect(getDenomConfigMock).not.toHaveBeenCalled()
    })
})
