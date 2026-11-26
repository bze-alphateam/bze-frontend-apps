import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// REST endpoint from settings, cache in an in-memory stand-in for localStorage.
const { settingsMock, store, setMock, clock } = vi.hoisted(() => ({
    settingsMock: vi.fn(),
    store: new Map<string, { v: string; expiry: number }>(),
    setMock: vi.fn(),
    clock: { now: 0 },
}))

vi.mock('../storage/settings', () => ({ getSettings: settingsMock }))
vi.mock('../storage/storage', () => ({
    // Honours the TTL like the real storage: an entry older than its ttl is gone.
    getFromLocalStorage: (k: string) => {
        const e = store.get(k)
        return e && clock.now < e.expiry ? e.v : null
    },
    setInLocalStorage: (k: string, v: string, ttl: number) => { setMock(k, v, ttl); store.set(k, { v, expiry: clock.now + ttl * 1000 }); return true },
}))

import { getAutomationPaused, getBlockedDenoms, getClosedChannels } from './guardian'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const NOT_IMPLEMENTED = { code: 12, message: 'Not Implemented' }

const readers = [
    { name: 'getClosedChannels', fn: getClosedChannels, path: 'closed_channels', body: { channel_ids: ['channel-3', 'channel-7'] }, value: ['channel-3', 'channel-7'], empty: { channel_ids: [] }, fallback: [] as unknown },
    { name: 'getBlockedDenoms', fn: getBlockedDenoms, path: 'blocked_denoms', body: { denoms: ['ubze', 'ibc/ABC'] }, value: ['ubze', 'ibc/ABC'], empty: { denoms: [] }, fallback: [] as unknown },
    { name: 'getAutomationPaused', fn: getAutomationPaused, path: 'automation_paused', body: { paused: true }, value: true, empty: { paused: false }, fallback: false as unknown },
]

describe.each(readers)('$name', ({ fn, path, body, value, empty, fallback }) => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        store.clear()
        setMock.mockReset()
        // Each test starts an hour after the previous one, so failures remembered in memory never leak across tests.
        clock.now += 3_600_000
        vi.spyOn(Date, 'now').mockImplementation(() => clock.now)
        settingsMock.mockReturnValue({ endpoints: { restEndpoint: 'https://rest.example' } })
        fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
        vi.spyOn(console, 'error').mockImplementation(() => {}); vi.mocked(console.error).mockClear()
    })

    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

    it('reads the v8.3.0 body and caches it for 60 seconds', async () => {
        fetchMock.mockResolvedValue(json(body))

        expect(await fn()).toEqual(value)
        expect(fetchMock).toHaveBeenCalledWith(`https://rest.example/bze/guardian/v1/${path}`)
        expect(setMock).toHaveBeenCalledWith(expect.stringContaining('guardian:'), JSON.stringify(value), 60)
    })

    it('reads an empty answer as nothing active', async () => {
        fetchMock.mockResolvedValue(json(empty))

        expect(await fn()).toEqual(fallback)
    })

    it('answers from the cache within the TTL without a request', async () => {
        fetchMock.mockResolvedValue(json(body))
        await fn()
        fetchMock.mockClear()

        expect(await fn()).toEqual(value)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('treats HTTP 501 (v8.2.0 node) as nothing active and caches nothing', async () => {
        fetchMock.mockResolvedValue(json(NOT_IMPLEMENTED, 501))

        expect(await fn()).toEqual(fallback)
        expect(setMock).not.toHaveBeenCalled()
        expect(console.error).toHaveBeenCalledTimes(1)
    })

    it('treats a network error as nothing active and retries next time', async () => {
        fetchMock.mockRejectedValueOnce(new Error('network down'))

        expect(await fn()).toEqual(fallback)
        expect(setMock).not.toHaveBeenCalled()

        clock.now += 61_000
        fetchMock.mockResolvedValue(json(body))
        expect(await fn()).toEqual(value)
    })

    it('sends one request for concurrent callers', async () => {
        fetchMock.mockResolvedValue(json(body))

        const results = await Promise.all([fn(), fn(), fn()])

        expect(results).toEqual([value, value, value])
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('does not refetch or log again inside a minute after a failure', async () => {
        fetchMock.mockResolvedValue(json(NOT_IMPLEMENTED, 501))

        await fn()
        clock.now += 59_000
        expect(await fn()).toEqual(fallback)

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(console.error).toHaveBeenCalledTimes(1)
    })

    it('fetches again once the failure memory is over a minute old', async () => {
        fetchMock.mockResolvedValue(json(NOT_IMPLEMENTED, 501))
        await fn()

        clock.now += 61_000
        await fn()

        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('caches a success that follows a failure', async () => {
        fetchMock.mockResolvedValueOnce(json(NOT_IMPLEMENTED, 501))
        await fn()
        clock.now += 61_000
        fetchMock.mockResolvedValue(json(body))
        expect(await fn()).toEqual(value)
        fetchMock.mockClear()

        expect(await fn()).toEqual(value)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('refetches when the cached entry is older than 60 seconds', async () => {
        fetchMock.mockResolvedValueOnce(json(body))
        expect(await fn()).toEqual(value)

        clock.now += 61_000
        fetchMock.mockResolvedValue(json(empty))

        expect(await fn()).toEqual(fallback)
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })
})
