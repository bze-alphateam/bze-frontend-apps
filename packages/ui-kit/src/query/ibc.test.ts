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
// Literal sha256 of the trace (path + '/' + base denom), so the expectation does not reuse the code's own hashing.
const SINGLE_HASH = '9DA252F9F9C86132CC282EA431DFB7DE7729501F6DC9A3E0F50EC8C6EE380CC7' // transfer/channel-0/ulmn
const MULTI_HASH = 'D315ADD5DCD667EB61C44FDD303D8B278C7A6E4F00D2BA0B004754CC4D2084F3' // transfer/channel-0/transfer/channel-7/uatom
const OLD_ULMN = { path: 'transfer/channel-0', base_denom: 'ulmn' }
const v10Ulmn = () => v10('ulmn', [{ port_id: 'transfer', channel_id: 'channel-0' }])

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
        route({ [`${BASE}/denoms/${SINGLE_HASH}`]: () => v10Ulmn() })

        const trace = await getHashIBCTrace(SINGLE_HASH)

        expect(trace).toEqual(OLD_ULMN)
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
    })

    it('strips an ibc/ prefix so it never lands in the path twice', async () => {
        const fetchMock = route({ [`${BASE}/denoms/${SINGLE_HASH}`]: () => v10Ulmn() })

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
            [`${BASE}/denom_traces/${SINGLE_HASH}`]: () => json(200, { denom_trace: OLD_ULMN }),
        })

        expect(await getHashIBCTrace(`ibc/${SINGLE_HASH}`)).toEqual(OLD_ULMN)
        expect(fetchMock).toHaveBeenLastCalledWith(`${BASE}/denom_traces/${SINGLE_HASH}`)
        expect(setInLocalStorageMock).toHaveBeenCalledWith(`ibc:traces:${SINGLE_HASH}`, expect.any(String), 0)
    })

    it('falls back to the old route on a network error of the v10 route', async () => {
        route({
            [`${BASE}/denom_traces/${SINGLE_HASH}`]: () => json(200, { denom_trace: OLD_ULMN }),
        })

        expect(await getHashIBCTrace(SINGLE_HASH)).toEqual(OLD_ULMN)
    })

    it('returns undefined and caches nothing when both routes fail', async () => {
        route({
            [`${BASE}/denoms/${SINGLE_HASH}`]: () => json(501, {}),
            [`${BASE}/denom_traces/${SINGLE_HASH}`]: () => json(501, {}),
        })

        expect(await getHashIBCTrace(SINGLE_HASH)).toBeUndefined()
        expect(setInLocalStorageMock).not.toHaveBeenCalled()
    })

    it.each([
        ['no denom', {}],
        ['a non-string base', { denom: { base: 7, trace: [{ port_id: 'transfer', channel_id: 'channel-0' }] } }],
        ['a missing trace', { denom: { base: 'ulmn' } }],
        ['an empty trace', { denom: { base: 'ulmn', trace: [] } }],
        ['a hop without channel', { denom: { base: 'ulmn', trace: [{ port_id: 'transfer' }] } }],
    ])('falls back to the old route when a v10 200 has %s', async (_name, body) => {
        route({
            [`${BASE}/denoms/${SINGLE_HASH}`]: () => json(200, body),
            [`${BASE}/denom_traces/${SINGLE_HASH}`]: () => json(200, { denom_trace: OLD_ULMN }),
        })

        expect(await getHashIBCTrace(SINGLE_HASH)).toEqual(OLD_ULMN)
    })

    it('falls back to the old route on a v10 400', async () => {
        route({
            [`${BASE}/denoms/${SINGLE_HASH}`]: () => json(400, { code: 3 }),
            [`${BASE}/denom_traces/${SINGLE_HASH}`]: () => json(200, { denom_trace: OLD_ULMN }),
        })

        expect(await getHashIBCTrace(SINGLE_HASH)).toEqual(OLD_ULMN)
    })

    it('rejects a v10 answer that does not hash to the requested denom and uses the old route', async () => {
        route({
            [`${BASE}/denoms/${SINGLE_HASH}`]: () => v10('uosmo', [{ port_id: 'transfer', channel_id: 'channel-0' }]),
            [`${BASE}/denom_traces/${SINGLE_HASH}`]: () => json(200, { denom_trace: OLD_ULMN }),
        })

        expect(await getHashIBCTrace(SINGLE_HASH)).toEqual(OLD_ULMN)
        expect(setInLocalStorageMock).toHaveBeenCalledTimes(1)
        expect(setInLocalStorageMock).toHaveBeenCalledWith(`ibc:traces:${SINGLE_HASH}`, JSON.stringify(OLD_ULMN), 0)
    })

    it('rejects an old-route answer that does not hash to the requested denom', async () => {
        route({
            [`${BASE}/denoms/${SINGLE_HASH}`]: () => json(501, {}),
            [`${BASE}/denom_traces/${SINGLE_HASH}`]: () => json(200, { denom_trace: { path: 'transfer/channel-0', base_denom: 'uosmo' } }),
        })

        expect(await getHashIBCTrace(SINGLE_HASH)).toBeUndefined()
        expect(setInLocalStorageMock).not.toHaveBeenCalled()
    })

    it('answers undefined when the old route answers 200 without a denom_trace', async () => {
        route({
            [`${BASE}/denoms/${SINGLE_HASH}`]: () => json(501, {}),
            [`${BASE}/denom_traces/${SINGLE_HASH}`]: () => json(200, {}),
        })

        expect(await getHashIBCTrace(SINGLE_HASH)).toBeUndefined()
        expect(setInLocalStorageMock).not.toHaveBeenCalled()
    })

    it('serves a cached entry without any request', async () => {
        getFromLocalStorageMock.mockReturnValue(JSON.stringify(OLD_ULMN))
        const fetchMock = route({})

        expect(await getHashIBCTrace(SINGLE_HASH)).toEqual(OLD_ULMN)
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
                denoms: [{ base: 'ulmn', trace: [{ port_id: 'transfer', channel_id: 'channel-0' }] }],
                pagination: { next_key: 'abc+/=' },
            }),
            [`${BASE}/denoms?pagination.limit=1000&pagination.key=abc%2B%2F%3D`]: () => json(200, {
                denoms: [{ base: 'uatom', trace: [{ port_id: 'transfer', channel_id: 'channel-0' }, { port_id: 'transfer', channel_id: 'channel-7' }] }],
                pagination: { next_key: null },
            }),
        })

        const traces = await getIBCTraces()

        expect(traces).toEqual([
            OLD_ULMN,
            { path: 'transfer/channel-0/transfer/channel-7', base_denom: 'uatom' },
        ])
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(setInLocalStorageMock).toHaveBeenCalledWith('ibc:traces', JSON.stringify(traces), 300)
    })

    it('skips malformed v10 entries instead of mapping them', async () => {
        route({
            [`${BASE}/denoms?pagination.limit=1000`]: () => json(200, {
                denoms: [
                    { base: 'ulmn', trace: [{ port_id: 'transfer', channel_id: 'channel-0' }] },
                    { base: 'uatom' },
                    { base: 'uosmo', trace: [{ port_id: 'transfer' }] },
                ],
                pagination: { next_key: null },
            }),
        })

        expect(await getIBCTraces()).toEqual([OLD_ULMN])
    })

    it('falls back to the old list route on a network error', async () => {
        route({
            [`${BASE}/denom_traces?pagination.limit=1000`]: () => json(200, { denom_traces: [OLD_ULMN] }),
        })

        expect(await getIBCTraces()).toEqual([OLD_ULMN])
    })

    it('stops at the page cap and does not cache a partial list', async () => {
        const fetchMock = vi.fn(async () => json(200, {
            denoms: [{ base: 'ulmn', trace: [{ port_id: 'transfer', channel_id: 'channel-0' }] }],
            pagination: { next_key: 'more' },
        }))
        vi.stubGlobal('fetch', fetchMock)

        const traces = await getIBCTraces()

        expect(fetchMock).toHaveBeenCalledTimes(10)
        expect(traces).toHaveLength(10)
        expect(setInLocalStorageMock).not.toHaveBeenCalled()
        expect(console.error).toHaveBeenCalled()
    })

    it('falls back to the old list route on a 501', async () => {
        const old = [OLD_ULMN]
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
