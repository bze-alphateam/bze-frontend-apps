// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const { channelsMock, denomsMock } = vi.hoisted(() => ({ channelsMock: vi.fn(), denomsMock: vi.fn() }))

vi.mock('../query/guardian', () => ({
    getClosedChannels: () => channelsMock(),
    getBlockedDenoms: () => denomsMock(),
}))

import { useIbcRouteStatus } from './useIbcRouteStatus'

const HASH = 'ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4'

describe('useIbcRouteStatus', () => {
    beforeEach(() => {
        channelsMock.mockReset().mockResolvedValue(['channel-3'])
        denomsMock.mockReset().mockResolvedValue([HASH, 'ubze'])
    })

    it('stops nothing while loading', () => {
        channelsMock.mockReturnValue(new Promise(() => {}))
        const { result } = renderHook(() => useIbcRouteStatus())

        expect(result.current.loading).toBe(true)
        expect(result.current.isChannelClosed('channel-3')).toBe(false)
        expect(result.current.isDenomBlocked('ubze')).toBe(false)
    })

    it('matches channels exactly', async () => {
        const { result } = renderHook(() => useIbcRouteStatus())
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.isChannelClosed('channel-3')).toBe(true)
        expect(result.current.isChannelClosed('channel-30')).toBe(false)
        expect(result.current.isChannelClosed('channel-0')).toBe(false)
        expect(result.current.isChannelClosed(undefined)).toBe(false)
    })

    it('matches denoms exactly and case-sensitively', async () => {
        const { result } = renderHook(() => useIbcRouteStatus())
        await waitFor(() => expect(result.current.loading).toBe(false))

        expect(result.current.isDenomBlocked(HASH)).toBe(true)
        expect(result.current.isDenomBlocked(HASH.toLowerCase())).toBe(false)
        expect(result.current.isDenomBlocked('ubze')).toBe(true)
        expect(result.current.isDenomBlocked('ubz')).toBe(false)
        expect(result.current.isDenomBlocked('')).toBe(false)
    })

    it('reloads when the refresh key changes', async () => {
        const { result, rerender } = renderHook(({ k }) => useIbcRouteStatus(k), { initialProps: { k: 1 } })
        await waitFor(() => expect(result.current.loading).toBe(false))
        channelsMock.mockResolvedValue(['channel-9'])

        rerender({ k: 2 })

        await waitFor(() => expect(result.current.isChannelClosed('channel-9')).toBe(true))
        expect(result.current.isChannelClosed('channel-3')).toBe(false)
    })

    it('refresh re-reads both lists, updates the hook and returns the fresh checks', async () => {
        const { result } = renderHook(() => useIbcRouteStatus())
        await waitFor(() => expect(result.current.loading).toBe(false))
        channelsMock.mockResolvedValue(['channel-3', 'channel-8'])
        denomsMock.mockResolvedValue([])

        let fresh!: Awaited<ReturnType<typeof result.current.refresh>>
        await act(async () => { fresh = await result.current.refresh() })

        expect(fresh.isChannelClosed('channel-8')).toBe(true)
        expect(fresh.isDenomBlocked('ubze')).toBe(false)
        expect(result.current.isChannelClosed('channel-8')).toBe(true)
        expect(result.current.isDenomBlocked('ubze')).toBe(false)
    })
})
