// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const { skipGetRoute } = vi.hoisted(() => ({ skipGetRoute: vi.fn() }))

vi.mock('../query/skip', () => ({ skipGetRoute }))
vi.mock('../utils/debounce', () => ({
    addDebounce: (_key: string, _ms: number, run: () => void) => run(),
    cancelDebounce: () => {},
}))

import { useBuyRoute } from './useBuyRoute'

const lookUpRoute = () => renderHook(() => useBuyRoute('42161', 'usdc', 6, '100')).result

describe('useBuyRoute', () => {
    beforeEach(() => {
        skipGetRoute.mockReset()
    })

    it('asks only for routes the user can finish with one transaction', async () => {
        skipGetRoute.mockResolvedValue({ amount_out: '1000000', txs_required: 1 })

        const result = lookUpRoute()

        await waitFor(() => expect(result.current.rawRoute).toBeDefined())
        expect(skipGetRoute.mock.calls[0][0].allow_multi_tx).toBe(false)
    })

    it('explains when there is no single-transaction route', async () => {
        skipGetRoute.mockResolvedValue(undefined)

        const result = lookUpRoute()

        await waitFor(() => expect(result.current.error).toContain('single-transaction'))
        expect(result.current.rawRoute).toBeUndefined()
    })
})
