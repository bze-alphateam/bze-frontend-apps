// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const { listMock } = vi.hoisted(() => ({ listMock: vi.fn() }))
vi.mock('../query/circuit', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../query/circuit')>()),
    getDisabledMessages: listMock,
}))

import { usePausedMessages } from './usePausedMessages'

const SWAP = '/bze.tradebin.MsgMultiSwap'
const ORDER = '/bze.tradebin.MsgCreateOrder'

describe('usePausedMessages', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        listMock.mockReset()
    })
    afterEach(() => vi.useRealTimers())

    it('reports only the given types that are on the list', async () => {
        listMock.mockResolvedValue([SWAP, '/other.Msg'])
        const { result } = renderHook(() => usePausedMessages([SWAP, ORDER]))

        expect(result.current).toEqual({ paused: [], isPaused: false })
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })

        expect(result.current).toEqual({ paused: [SWAP], isPaused: true })
    })

    it('stays unpaused when the list is empty', async () => {
        listMock.mockResolvedValue([])
        const { result } = renderHook(() => usePausedMessages([SWAP]))
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })

        expect(result.current.isPaused).toBe(false)
    })

    it('refreshes every 60 seconds and picks up a later pause and the re-enable', async () => {
        listMock.mockResolvedValue([])
        const { result } = renderHook(() => usePausedMessages([SWAP]))
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        expect(result.current.isPaused).toBe(false)

        listMock.mockResolvedValue([SWAP])
        await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
        expect(result.current.isPaused).toBe(true)

        listMock.mockResolvedValue([])
        await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
        expect(result.current.isPaused).toBe(false)
    })

    it('stops polling on unmount', async () => {
        listMock.mockResolvedValue([])
        const { unmount } = renderHook(() => usePausedMessages([SWAP]))
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        unmount()
        listMock.mockClear()

        await vi.advanceTimersByTimeAsync(180_000)

        expect(listMock).not.toHaveBeenCalled()
    })
})
