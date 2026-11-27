// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'

const { getRateLimit } = vi.hoisted(() => ({ getRateLimit: vi.fn() }))
vi.mock('../query/rate_limit', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../query/rate_limit')>()),
    getRateLimit,
}))

import { useRouteLimit } from './useRouteLimit'

const B = (n: number) => BigInt(n)
const limit = (o: Partial<Record<string, bigint | number>> = {}) => ({
    sendRoom: B(10), recvRoom: B(20), sendThreshold: B(100), recvThreshold: B(200), durationHours: 24, ...o,
})

beforeEach(() => getRateLimit.mockReset())
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('useRouteLimit', () => {
    it('picks the room of the asked direction', async () => {
        getRateLimit.mockResolvedValue(limit())
        const send = renderHook(() => useRouteLimit('channel-0', 'ubze', 'send'))
        const recv = renderHook(() => useRouteLimit('channel-0', 'ubze', 'receive'))

        await waitFor(() => expect(send.result.current.room).toBe(B(10)))
        await waitFor(() => expect(recv.result.current.room).toBe(B(20)))
        expect(getRateLimit).toHaveBeenCalledWith('channel-0', 'ubze')
    })

    it('reports a zero threshold as stopped', async () => {
        getRateLimit.mockResolvedValue(limit({ recvThreshold: B(0), recvRoom: B(0) }))
        const { result } = renderHook(() => useRouteLimit('channel-0', 'ubze', 'receive'))

        await waitFor(() => expect(result.current.stopped).toBe(true))
    })

    it('null means no limit and is not loading', async () => {
        getRateLimit.mockResolvedValue(null)
        const { result } = renderHook(() => useRouteLimit('channel-0', 'ubze', 'send'))

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.room).toBeUndefined()
        expect(result.current.stopped).toBe(false)
    })

    it('ignores the stale result of a previous route', async () => {
        let resolveFirst: (v: unknown) => void = () => {}
        getRateLimit.mockImplementationOnce(() => new Promise(res => { resolveFirst = res }))
        getRateLimit.mockResolvedValueOnce(limit({ sendRoom: B(77) }))
        const { result, rerender } = renderHook(({ ch }) => useRouteLimit(ch, 'ubze', 'send'), { initialProps: { ch: 'channel-0' } })
        rerender({ ch: 'channel-3' })
        await waitFor(() => expect(result.current.room).toBe(B(77)))

        await act(async () => { resolveFirst(limit({ sendRoom: B(1) })) })

        expect(result.current.room).toBe(B(77))
    })

    it('treats the limit as unknown and reads again once its window resets', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
        vi.setSystemTime(new Date('2026-11-26T23:59:50Z'))
        getRateLimit.mockResolvedValueOnce(limit({ sendRoom: B(0) })).mockResolvedValueOnce(limit({ sendRoom: B(500) }))
        const { result } = renderHook(() => useRouteLimit('channel-0', 'ubze', 'send'))
        await act(async () => { await Promise.resolve() })
        expect(result.current.room).toBe(B(0))

        await act(async () => { await vi.advanceTimersByTimeAsync(10_000) }) // reaches 00:00:00
        expect(result.current.room).toBe(B(0)) // grace period: still waiting for the chain's reset block

        await act(async () => { await vi.advanceTimersByTimeAsync(7_000) })

        expect(getRateLimit).toHaveBeenCalledTimes(2)
        expect(result.current.room).toBe(B(500))
    })
})
