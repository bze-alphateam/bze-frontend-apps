import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }))

vi.mock('../storage/settings', () => ({ getSettings: () => ({ endpoints: { restEndpoint: 'https://rest.example' } }) }))
vi.mock('../storage/storage', () => ({
    getFromLocalStorage: (k: string) => store.get(k) ?? null,
    setInLocalStorage: (k: string, v: string) => { store.set(k, v); return true },
    removeFromLocalStorage: (k: string) => { store.delete(k) },
}))

import { getAutomationPaused, invalidateAutomationPaused } from './guardian'

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

describe('invalidateAutomationPaused', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        store.clear()
        fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => vi.unstubAllGlobals())

    it('makes the next read ask the chain again', async () => {
        fetchMock.mockResolvedValueOnce(json({ paused: false }))
        expect(await getAutomationPaused()).toBe(false)

        invalidateAutomationPaused()
        fetchMock.mockResolvedValueOnce(json({ paused: true }))

        expect(await getAutomationPaused()).toBe(true)
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('does not let a read that was in flight write its older answer to the cache', async () => {
        let resolveOld!: (r: Response) => void
        fetchMock.mockReturnValueOnce(new Promise<Response>(res => { resolveOld = res }))
        const oldRead = getAutomationPaused()

        invalidateAutomationPaused()
        resolveOld(json({ paused: false }))
        await oldRead

        fetchMock.mockResolvedValueOnce(json({ paused: true }))
        expect(await getAutomationPaused()).toBe(true)
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })
})
