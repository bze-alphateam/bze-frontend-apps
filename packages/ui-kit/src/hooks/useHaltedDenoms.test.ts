// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// The hook reads the halted list from the query and resolves market / pool ids through the
// app's assets context; both are fed directly.
const { getHaltedDenomsMock, useAssetsContextMock } = vi.hoisted(() => ({
    getHaltedDenomsMock: vi.fn(),
    useAssetsContextMock: vi.fn(),
}))

vi.mock('../query/halted_denoms', () => ({ getHaltedDenoms: () => getHaltedDenomsMock() }))
vi.mock('./useAssets', () => ({ useAssetsContext: () => useAssetsContextMock() }))

import { useHaltedDenoms } from './useHaltedDenoms'

const HALTED = 'factory/bze1creator/uhalt'
const OTHER = 'factory/bze1creator/uother'
const MARKET_ID = `${HALTED}/ubze`
const POOL_ID = `${HALTED}_ubze`

describe('useHaltedDenoms', () => {
    beforeEach(() => {
        getHaltedDenomsMock.mockReset().mockResolvedValue([HALTED])
        useAssetsContextMock.mockReturnValue({
            marketsMap: new Map([[MARKET_ID, { base: HALTED, quote: 'ubze' }], ['ubze/uusdc', { base: 'ubze', quote: 'uusdc' }]]),
            poolsMap: new Map([[POOL_ID, { base: 'ubze', quote: HALTED }]]),
        })
    })

    const render = async () => {
        const { result } = renderHook(() => useHaltedDenoms())
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        return result.current
    }

    it('is loading and halts nothing until the list arrives', () => {
        getHaltedDenomsMock.mockReturnValue(new Promise(() => {}))
        const { result } = renderHook(() => useHaltedDenoms())

        expect(result.current.isLoading).toBe(true)
        expect(result.current.isDenomHalted(HALTED)).toBe(false)
    })

    it('matches denoms exactly', async () => {
        const h = await render()

        expect(h.haltedDenoms).toEqual(new Set([HALTED]))
        expect(h.isDenomHalted(HALTED)).toBe(true)
        expect(h.isDenomHalted(OTHER)).toBe(false)
        expect(h.isDenomHalted('factory/bze1creator/uhal')).toBe(false)
        expect(h.isDenomHalted(undefined)).toBe(false)
    })

    it('halts a market or pool when the base or the quote is halted', async () => {
        const h = await render()

        expect(h.isMarketHalted({ base: HALTED, quote: 'ubze' })).toBe(true)
        expect(h.isMarketHalted({ base: 'ubze', quote: HALTED })).toBe(true)
        expect(h.isMarketHalted({ base: 'ubze', quote: OTHER })).toBe(false)
        expect(h.isPoolHalted({ base: 'ubze', quote: HALTED })).toBe(true)
        expect(h.isPoolHalted({ base: OTHER, quote: 'ubze' })).toBe(false)
    })

    it('resolves market and pool ids through the context instead of parsing them', async () => {
        const h = await render()

        expect(h.isMarketHalted(MARKET_ID)).toBe(true)
        expect(h.isMarketHalted('ubze/uusdc')).toBe(false)
        expect(h.isPoolHalted(POOL_ID)).toBe(true)
        // An id that merely contains the halted denom but is not a known market/pool never matches.
        expect(h.isMarketHalted(`${HALTED}/uunknown`)).toBe(false)
        expect(h.isPoolHalted(`${HALTED}_uunknown`)).toBe(false)
    })

    it('halts nothing when the query failed open', async () => {
        getHaltedDenomsMock.mockResolvedValue([])
        const h = await render()

        expect(h.isMarketHalted(MARKET_ID)).toBe(false)
        expect(h.isPoolHalted(POOL_ID)).toBe(false)
    })
})
