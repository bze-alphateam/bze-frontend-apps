import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The query talks to the node over fetch and caches in localStorage; both are replaced so each
// test controls the wire answers and sees what would be cached.
const { getFromLocalStorageMock, setInLocalStorageMock } = vi.hoisted(() => ({
    getFromLocalStorageMock: vi.fn(),
    setInLocalStorageMock: vi.fn(),
}))

vi.mock('../storage/storage', () => ({
    getFromLocalStorage: getFromLocalStorageMock,
    setInLocalStorage: setInLocalStorageMock,
}))
vi.mock('../storage/settings', () => ({
    getSettings: () => ({ endpoints: { restEndpoint: 'https://rest.test' } }),
}))

import { getHashIBCTrace, getIBCTraces } from './ibc'

const BASE = 'https://rest.test/ibc/apps/transfer/v1'
const sha = (s: string) => createHash('sha256').update(s).digest('hex').toUpperCase()

const SINGLE_HASH = sha('transfer/channel-3/uusdc')
const MULTI_HASH = sha('transfer/channel-0/transfer/channel-7/uatom')

const json = (status: number, body: unknown) => ({ status, ok: status >= 200 && status < 300, json: async () => body }) as Response

const v10 = (base: string, trace: { port_id: string; channel_id: string }[]) => json(200, { denom: { base, trace } })

// Routes fetch by URL; any unrouted URL fails like a dead node.
const route = (routes: Record<string, () => Response | Promise<Response>>) => {
    const fetchMock = vi.fn(async (url: string) => {
        const handler = routes[url]
        if (!handler) throw new TypeError(`unrouted ${url}`)
        return handler()
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

describe('getHashIBCTrace', () => {
    beforeEach(() => {
        getFromLocalStorageMock.mockReset().mockReturnValue(null)
        setInLocalStorageMock.mockReset()
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('maps a single-hop v10 answer to the old trace shape and caches it', async () => {
        route({ [`${BASE}/denoms/${SINGLE_HASH}`]: () => v10('uusdc', [{ port_id: 'transfer', channel_id: 'channel-3' }]) })

        const trace = await getHashIBCTrace(SINGLE_HASH)

        expect(trace).toEqual({ path: 'transfer/channel-3', base_denom: 'uusdc' })
        expect(`ibc/${sha(`${trace!.path}/${trace!.base_denom}`)}`).toBe(`ibc/${SINGLE_HASH}`)
        expect(setInLocalStorageMock).toHaveBeenCalledWith(`ibc:traces:${SINGLE_HASH}`, JSON.stringify(trace), 0)
    })

    it('joins the hops of a multi-hop v10 answer in order', async () => {
        route({
            [`${BASE}/denoms/${MULTI_HASH}`]: () => v10('uatom', [
                { port_id: 'transfer', channel_id: 'channel-0' },
                { port_id: 'transfer', channel_id: 'channel-7' },
            ]),
        })

        const trace = await getHashIBCTrace(MULTI_HASH)

        expect(trace).toEqual({ path: 'transfer/channel-0/transfer/channel-7', base_denom: 'uatom' })
        expect(`ibc/${sha(`${trace!.path}/${trace!.base_denom}`)}`).toBe(`ibc/${MULTI_HASH}`)
    })

    it('strips an ibc/ prefix so it never lands in the path twice', async () => {
        const fetchMock = route({ [`${BASE}/denoms/${SINGLE_HASH}`]: () => v10('uusdc', [{ port_id: 'transfer', channel_id: 'channel-3' }]) })

        await getHashIBCTrace(`ibc/${SINGLE_HASH}`)

        expect(fetchMock).toHaveBeenCalledWith(`${BASE}/denoms/${SINGLE_HASH}`)
    })

    it('answers undefined on a v10 404 without trying the old route', async () => {
        const fetchMock = route({ [`${BASE}/denoms/${SINGLE_HASH}`]: () => json(404, { code: 5 }) })

        expect(await getHashIBCTrace(SINGLE_HASH)).toBeUndefined()
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(setInLocalStorageMock).not.toHaveBeenCalled()
    })

    it('falls back to the old route when the node answers 501 (v8.2.0)', async () => {
        const fetchMock = route({
            [`${BASE}/denoms/${SINGLE_HASH}`]: () => json(501, { code: 12 }),
            [`${BASE}/denom_traces/${SINGLE_HASH}`]: () => json(200, { denom_trace: { path: 'transfer/channel-3', base_denom: 'uusdc' } }),
        })

        expect(await getHashIBCTrace(`ibc/${SINGLE_HASH}`)).toEqual({ path: 'transfer/channel-3', base_denom: 'uusdc' })
        expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/denom_traces/${SINGLE_HASH}`)
        expect(setInLocalStorageMock).toHaveBeenCalledWith(`ibc:traces:${SINGLE_HASH}`, expect.any(String), 0)
    })

    it('falls back to the old route on a network error of the v10 route', async () => {
        route({
            [`${BASE}/denom_traces/${SINGLE_HASH}`]: () => json(200, { denom_trace: { path: 'transfer/channel-3', base_denom: 'uusdc' } }),
        })

        expect(await getHashIBCTrace(SINGLE_HASH)).toEqual({ path: 'transfer/channel-3', base_denom: 'uusdc' })
    })

    it('returns undefined and caches nothing when both routes fail', async () => {
        route({
            [`${BASE}/denoms/${SINGLE_HASH}`]: () => json(501, {}),
            [`${BASE}/denom_traces/${SINGLE_HASH}`]: () => json(501, {}),
        })

        expect(await getHashIBCTrace(SINGLE_HASH)).toBeUndefined()
        expect(setInLocalStorageMock).not.toHaveBeenCalled()
    })

    it('serves a cached entry without any request', async () => {
        getFromLocalStorageMock.mockReturnValue(JSON.stringify({ path: 'transfer/channel-3', base_denom: 'uusdc' }))
        const fetchMock = route({})

        expect(await getHashIBCTrace(SINGLE_HASH)).toEqual({ path: 'transfer/channel-3', base_denom: 'uusdc' })
        expect(fetchMock).not.toHaveBeenCalled()
    })
})

describe('getIBCTraces', () => {
    beforeEach(() => {
        getFromLocalStorageMock.mockReset().mockReturnValue(null)
        setInLocalStorageMock.mockReset()
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('reads every v10 page and maps each entry', async () => {
        const fetchMock = route({
            [`${BASE}/denoms?pagination.limit=1000`]: () => json(200, {
                denoms: [{ base: 'uusdc', trace: [{ port_id: 'transfer', channel_id: 'channel-3' }] }],
                pagination: { next_key: 'abc+/=' },
            }),
            [`${BASE}/denoms?pagination.limit=1000&pagination.key=abc%2B%2F%3D`]: () => json(200, {
                denoms: [{ base: 'uatom', trace: [{ port_id: 'transfer', channel_id: 'channel-0' }, { port_id: 'transfer', channel_id: 'channel-7' }] }],
                pagination: { next_key: null },
            }),
        })

        const traces = await getIBCTraces()

        expect(traces).toEqual([
            { path: 'transfer/channel-3', base_denom: 'uusdc' },
            { path: 'transfer/channel-0/transfer/channel-7', base_denom: 'uatom' },
        ])
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(setInLocalStorageMock).toHaveBeenCalledWith('ibc:traces', JSON.stringify(traces), 300)
    })

    it('falls back to the old list route on a 501', async () => {
        const old = [{ path: 'transfer/channel-3', base_denom: 'uusdc' }]
        route({
            [`${BASE}/denoms?pagination.limit=1000`]: () => json(501, {}),
            [`${BASE}/denom_traces?pagination.limit=1000`]: () => json(200, { denom_traces: old }),
        })

        expect(await getIBCTraces()).toEqual(old)
    })

    it('returns an empty list and caches nothing when both routes fail', async () => {
        route({
            [`${BASE}/denoms?pagination.limit=1000`]: () => json(501, {}),
            [`${BASE}/denom_traces?pagination.limit=1000`]: () => json(501, {}),
        })

        expect(await getIBCTraces()).toEqual([])
        expect(setInLocalStorageMock).not.toHaveBeenCalled()
    })
})
