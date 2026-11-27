import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { settingsMock, store, setMock } = vi.hoisted(() => ({
    settingsMock: vi.fn(),
    store: new Map<string, string>(),
    setMock: vi.fn(),
}))

vi.mock('../storage/settings', () => ({ getSettings: settingsMock }))
vi.mock('../storage/storage', () => ({
    getFromLocalStorage: (k: string) => store.get(k) ?? null,
    setInLocalStorage: (k: string, v: string, ttl: number) => { setMock(k, v, ttl); store.set(k, v); return true },
}))

import { getDisabledMessages, pausedAmong } from './circuit'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const URL = 'https://rest.example/cosmos/circuit/v1/disable_list'

describe('getDisabledMessages', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        store.clear()
        setMock.mockReset()
        settingsMock.mockReturnValue({ endpoints: { restEndpoint: 'https://rest.example' } })
        fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => vi.unstubAllGlobals())

    it('returns the list and caches it for 60 seconds', async () => {
        fetchMock.mockResolvedValue(json({ disabled_list: ['/bze.tradebin.MsgMultiSwap'] }))

        expect(await getDisabledMessages()).toEqual(['/bze.tradebin.MsgMultiSwap'])
        expect(fetchMock).toHaveBeenCalledWith(URL)
        expect(setMock).toHaveBeenCalledWith('circuit:disabled_messages', JSON.stringify(['/bze.tradebin.MsgMultiSwap']), 60)
    })

    it('reads an empty list (mainnet today) and caches it', async () => {
        fetchMock.mockResolvedValue(json({ disabled_list: [] }))

        expect(await getDisabledMessages()).toEqual([])
        expect(setMock).toHaveBeenCalledTimes(1)
    })

    it('reads a body without the field as empty', async () => {
        fetchMock.mockResolvedValue(json({}))

        expect(await getDisabledMessages()).toEqual([])
    })

    it('serves the cache without a request', async () => {
        store.set('circuit:disabled_messages', JSON.stringify(['/a.B']))

        expect(await getDisabledMessages()).toEqual(['/a.B'])
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('refetches when the cache holds garbage', async () => {
        store.set('circuit:disabled_messages', '{"not":"a list"}')
        fetchMock.mockResolvedValue(json({ disabled_list: ['/a.B'] }))

        expect(await getDisabledMessages()).toEqual(['/a.B'])
    })

    it.each([501, 500, 404])('fails open on HTTP %i and caches nothing', async (status) => {
        fetchMock.mockResolvedValue(json({ code: 12, message: 'Not Implemented' }, status))

        expect(await getDisabledMessages()).toEqual([])
        expect(setMock).not.toHaveBeenCalled()
    })

    it('fails open on a network error and caches nothing', async () => {
        fetchMock.mockRejectedValue(new Error('network down'))

        expect(await getDisabledMessages()).toEqual([])
        expect(setMock).not.toHaveBeenCalled()
    })

    it('fails open on an unexpected shape', async () => {
        fetchMock.mockResolvedValue(json({ disabled_list: 'nope' }))

        expect(await getDisabledMessages()).toEqual([])
        expect(setMock).not.toHaveBeenCalled()
    })

    it('shares one request between concurrent callers', async () => {
        fetchMock.mockResolvedValue(json({ disabled_list: ['/a.B'] }))

        const [a, b, c] = await Promise.all([getDisabledMessages(), getDisabledMessages(), getDisabledMessages()])

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect([a, b, c]).toEqual([['/a.B'], ['/a.B'], ['/a.B']])
    })
})

describe('pausedAmong', () => {
    it('returns the given type URLs that are on the list, exact match only', () => {
        expect(pausedAmong(['/a.Msg', '/b.Msg'], ['/a.Msg', '/c.Msg', '/b.MsgX'])).toEqual(['/a.Msg'])
        expect(pausedAmong([], ['/a.Msg'])).toEqual([])
        expect(pausedAmong(['/a.Msg'], [])).toEqual([])
    })
})
