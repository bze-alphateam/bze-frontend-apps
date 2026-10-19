// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

// Skip's status API is mocked: `skip.state` is what the next status poll answers
// (undefined = Skip does not know the tx yet).
const { skip, toastMock } = vi.hoisted(() => ({
    skip: { state: 'STATE_PENDING' as string | undefined },
    toastMock: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('../query/skip', () => ({
    skipTrackTx: vi.fn(async () => undefined),
    skipGetTxStatus: vi.fn(async () => (skip.state ? { state: skip.state, transfers: [] } : undefined)),
}))
vi.mock('./useToast', () => ({ useToast: () => ({ toast: toastMock }) }))
vi.mock('./useAssets', () => ({ useAssetsContext: () => ({ updateBalances: vi.fn() }) }))

import { useSkipTxTracker } from './useSkipTxTracker'

const MINUTE = 60_000

const buy = (amountIn: string) => ({
    direction: 'deposit' as const,
    sourceChainName: 'Osmosis',
    destChainName: 'BeeZee',
    assetTicker: 'OSMO',
    amountIn,
    estimatedAmountOut: '100',
    mechanism: 'skip' as const,
    txHash: `HASH${amountIn}`,
    broadcastChainId: 'osmosis-1',
})

const advance = async (ms: number) => {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
    })
}

const mount = () => renderHook(() => useSkipTxTracker())

describe('useSkipTxTracker (Latest Buy)', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        localStorage.clear()
        skip.state = 'STATE_PENDING'
        toastMock.success.mockReset()
        toastMock.error.mockReset()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('keeps only the latest buy: a second addTransaction replaces the first', () => {
        const { result } = mount()
        act(() => result.current.addTransaction(buy('1')))
        act(() => result.current.addTransaction(buy('2')))

        expect(result.current.transactions).toHaveLength(1)
        expect(result.current.transactions[0].amountIn).toBe('2')
    })

    it('keeps an in-progress buy past 1 minute', async () => {
        const { result } = mount()
        act(() => result.current.addTransaction(buy('1')))

        await advance(5 * MINUTE)

        expect(result.current.transactions).toHaveLength(1)
        expect(result.current.transactions[0].state).toBe('pending')
    })

    it('drops a finished buy 1 minute after it finished', async () => {
        const { result } = mount()
        act(() => result.current.addTransaction(buy('1')))

        await advance(5 * MINUTE)
        skip.state = 'STATE_COMPLETED_SUCCESS'
        await advance(10_000) // the next poll sees the final state

        expect(result.current.transactions[0].state).toBe('completed')
        expect(toastMock.success).toHaveBeenCalledOnce()

        await advance(MINUTE - 11_000)
        expect(result.current.transactions).toHaveLength(1)

        await advance(11_000)
        expect(result.current.transactions).toHaveLength(0)
    })

    it('dismissTransaction removes the buy at once', () => {
        const { result } = mount()
        act(() => result.current.addTransaction(buy('1')))
        act(() => result.current.dismissTransaction(result.current.transactions[0].id))

        expect(result.current.transactions).toHaveLength(0)
    })

    it('still drops a buy that never resolves after 1 hour', async () => {
        skip.state = undefined
        const { result } = mount()
        act(() => result.current.addTransaction(buy('1')))

        await advance(59 * MINUTE)
        expect(result.current.transactions).toHaveLength(1)

        await advance(MINUTE)
        expect(result.current.transactions).toHaveLength(0)
    })

    it('stores and reloads one record only', () => {
        const first = mount()
        act(() => first.result.current.addTransaction(buy('1')))
        act(() => first.result.current.addTransaction(buy('2')))
        first.unmount()

        const second = mount()
        expect(second.result.current.transactions.map((t) => t.amountIn)).toEqual(['2'])
    })

    it('reloads only the newest record of a list stored by an older version', () => {
        const first = mount()
        act(() => first.result.current.addTransaction(buy('1')))
        const stored = first.result.current.transactions[0]
        first.unmount()

        // Rewrite the stored entry as the old multi-record list (newest has the later timestamp).
        const key = Object.keys(localStorage).find((k) => k.endsWith('skip:pending-txs'))!
        const item = JSON.parse(localStorage.getItem(key)!)
        item.data = JSON.stringify([
            { ...stored, id: 'old', amountIn: 'old', timestamp: stored.timestamp - 1000 },
            { ...stored, id: 'new', amountIn: 'new' },
        ])
        localStorage.setItem(key, JSON.stringify(item))

        const second = mount()
        expect(second.result.current.transactions.map((t) => t.id)).toEqual(['new'])
    })
})
