// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

// The wallet, signing client and toasts are fed directly; a fixed fee skips simulation,
// so a tx only signs, broadcasts and reports the result.
const { toastMock, signAndBroadcastMock } = vi.hoisted(() => ({
    toastMock: {
        loading: vi.fn(() => 'toast-id'),
        dismiss: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
        clickableSuccess: vi.fn(),
    },
    signAndBroadcastMock: vi.fn(),
}))

vi.mock('@interchain-kit/react', () => ({
    useChain: () => ({ address: 'addr1', disconnect: vi.fn(), wallet: undefined, chain: undefined, getRpcEndpoint: vi.fn() }),
}))
vi.mock('./useSigningClient', () => ({
    useSigningClient: () => ({
        signingClient: { signAndBroadcast: signAndBroadcastMock },
        isSigningClientReady: true,
        signingClientError: undefined,
    }),
}))
vi.mock('./useToast', () => ({ useToast: () => ({ toast: toastMock }) }))
vi.mock('./useLiquidityPools', () => ({ useLiquidityPools: () => ({ getDenomsPool: vi.fn() }) }))
vi.mock('./useSettings', () => ({ useSettings: () => ({ feeDenom: 'ubze' }) }))
vi.mock('./useFeeTokens', () => ({ useFeeTokens: () => ({ isValidFeeDenom: () => true }) }))
vi.mock('../constants/chain', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../constants/chain')>()),
    getChainName: () => 'beezee',
}))

import { useBZETx, useIBCTx, TxStatus } from './useTx'

const FEE = { amount: [{ denom: 'ubze', amount: '1000' }], gas: '200000' }
const MSG = { typeUrl: '/cosmos.bank.v1beta1.MsgSend', value: {} }

describe('useTx success toast', () => {
    beforeEach(() => {
        Object.values(toastMock).forEach(m => m.mockClear())
        signAndBroadcastMock.mockReset()
        signAndBroadcastMock.mockResolvedValue({
            transactionHash: 'HASH',
            wait: async () => ({ code: 0, txhash: 'HASH', height: 10, events: [] }),
        })
    })

    it('links a BZE tx to the explorer', async () => {
        const { result } = renderHook(() => useBZETx())

        let ok = false
        await act(async () => { ok = await result.current.tx([MSG], { fee: FEE }) })

        expect(ok).toBe(true)
        expect(toastMock.clickableSuccess).toHaveBeenCalledWith(TxStatus.Successful, expect.any(Function), 'View on Explorer')
        expect(toastMock.success).not.toHaveBeenCalled()
    })

    // Regression: BZE Scan only knows BZE transactions, so a tx signed on another chain
    // (an IBC deposit) must never get a BZE Scan link. A develop merge once dropped this guard.
    it('gives a tx signed on another chain a plain toast without an explorer link', async () => {
        const { result } = renderHook(() => useIBCTx('osmosis'))

        let ok = false
        await act(async () => { ok = await result.current.tx([MSG], { fee: FEE }) })

        expect(ok).toBe(true)
        expect(toastMock.success).toHaveBeenCalledWith(TxStatus.Successful)
        expect(toastMock.clickableSuccess).not.toHaveBeenCalled()
    })
})

describe('useTx toasts and failure details', () => {
    beforeEach(() => {
        Object.values(toastMock).forEach(m => m.mockClear())
        signAndBroadcastMock.mockReset()
    })

    it('keeps today\'s toasts when the new options are not set', async () => {
        signAndBroadcastMock.mockResolvedValue({
            transactionHash: 'HASH',
            wait: async () => ({ code: 5, txhash: 'HASH', rawLog: 'insufficient funds', height: 10 }),
        })
        const onFailure = vi.fn()
        const { result } = renderHook(() => useBZETx())

        await act(async () => { await result.current.tx([MSG], { fee: FEE, onFailure }) })

        expect(toastMock.loading).toHaveBeenCalledTimes(1)
        expect(toastMock.error).toHaveBeenCalledWith(TxStatus.Failed, 'insufficient funds')
        expect(toastMock.dismiss).toHaveBeenCalledWith('toast-id')
        // The first argument is unchanged; the details are an extra, optional argument.
        expect(onFailure).toHaveBeenCalledWith('insufficient funds', { stage: 'chain', txHash: 'HASH', rawLog: 'insufficient funds', code: 5 })
    })

    it('fires no toast at all with toasts: false', async () => {
        signAndBroadcastMock.mockResolvedValue({
            transactionHash: 'HASH',
            wait: async () => ({ code: 0, txhash: 'HASH', height: 10 }),
        })
        const onSuccess = vi.fn()
        const { result } = renderHook(() => useBZETx())

        await act(async () => { await result.current.tx([MSG], { fee: FEE, onSuccess, toasts: false }) })

        expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ txhash: 'HASH', height: 10 }))
        Object.values(toastMock).forEach(m => expect(m).not.toHaveBeenCalled())
    })

    it('reports a wallet that never broadcast as the sign stage', async () => {
        signAndBroadcastMock.mockRejectedValue(new Error('Request rejected'))
        const onFailure = vi.fn()
        const onBroadcast = vi.fn()
        const { result } = renderHook(() => useBZETx())

        await act(async () => { await result.current.tx([MSG], { fee: FEE, onFailure, onBroadcast, toasts: false }) })

        expect(onBroadcast).not.toHaveBeenCalled()
        expect(onFailure).toHaveBeenCalledWith('Request rejected', { stage: 'sign', txHash: undefined, rawLog: 'Request rejected' })
        expect(toastMock.error).not.toHaveBeenCalled()
    })

    it('reports a wait that gave up after broadcast as the timeout stage', async () => {
        signAndBroadcastMock.mockResolvedValue({
            transactionHash: 'HASH',
            wait: async () => { throw new Error('Transaction HASH not found within timeout period') },
        })
        const onFailure = vi.fn()
        const { result } = renderHook(() => useBZETx())

        await act(async () => { await result.current.tx([MSG], { fee: FEE, onFailure, toasts: false }) })

        expect(onFailure).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ stage: 'timeout', txHash: 'HASH' }))
    })
})
