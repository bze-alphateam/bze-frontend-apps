import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The query reads the REST endpoint with a raw fetch and caches in localStorage; both are
// replaced so each test controls the wire response and the cache.
const { settingsMock, getFromLocalStorageMock, setInLocalStorageMock } = vi.hoisted(() => ({
    settingsMock: vi.fn(),
    getFromLocalStorageMock: vi.fn(),
    setInLocalStorageMock: vi.fn(),
}))

vi.mock('../storage/settings', () => ({ getSettings: settingsMock }))
vi.mock('../storage/storage', () => ({
    getFromLocalStorage: getFromLocalStorageMock,
    setInLocalStorage: setInLocalStorageMock,
}))

import { getDenomConfig, getDenomConfigInfo } from './denom_config'

const FACTORY = 'factory/bze1creator/utoken'
const REST = 'https://rest.example'
const configBody = (gas: string, transfer = '0.000000000000000000') => ({
    config: { community_pool: '', transfer_fee: transfer, gas_surcharge: gas },
})
const respond = (status: number, body: unknown) => ({ status, json: async () => body }) as Response

describe('getDenomConfig', () => {
    const fetchMock = vi.fn()

    beforeEach(() => {
        fetchMock.mockReset()
        vi.stubGlobal('fetch', fetchMock)
        settingsMock.mockReturnValue({ endpoints: { restEndpoint: REST } })
        getFromLocalStorageMock.mockReset().mockReturnValue(null)
        setInLocalStorageMock.mockReset()
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('reads the surcharge and transfer fee of a factory denom and caches them for five minutes', async () => {
        fetchMock.mockResolvedValue(respond(200, configBody('0.500000000000000000', '0.020000000000000000')))

        const config = await getDenomConfig(FACTORY)

        expect(fetchMock).toHaveBeenCalledWith(`${REST}/bze/tokenfactory/denom_config?denom=${encodeURIComponent(FACTORY)}`)
        expect(config.gasSurcharge.toString()).toBe('0.5')
        expect(config.transferFee.toString()).toBe('0.02')
        expect(setInLocalStorageMock).toHaveBeenCalledWith(
            `tokenfactory:denom_config:${FACTORY}`,
            JSON.stringify({ gasSurcharge: '0.5', transferFee: '0.02' }),
            300,
        )
    })

    it('answers from a fresh cache without a request', async () => {
        getFromLocalStorageMock.mockReturnValue(JSON.stringify({ gasSurcharge: '2', transferFee: '0.05' }))

        const config = await getDenomConfig(FACTORY)

        expect(getFromLocalStorageMock).toHaveBeenCalledWith(`tokenfactory:denom_config:${FACTORY}`)
        expect(config.gasSurcharge.toNumber()).toBe(2)
        expect(config.transferFee.toNumber()).toBe(0.05)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('reads zeros from the zero config of a token without one', async () => {
        fetchMock.mockResolvedValue(respond(200, configBody('0.000000000000000000')))

        const config = await getDenomConfig(FACTORY)

        expect(config.gasSurcharge.isZero()).toBe(true)
        expect(config.transferFee.isZero()).toBe(true)
    })

    it('reads zeros on a v8.2.0 node (501) and caches them so the next call makes no request', async () => {
        fetchMock.mockResolvedValue(respond(501, { code: 12, message: 'Not Implemented' }))

        const config = await getDenomConfig(FACTORY)

        expect(config.gasSurcharge.isZero()).toBe(true)
        expect(config.transferFee.isZero()).toBe(true)
        expect(setInLocalStorageMock).toHaveBeenCalledWith(
            `tokenfactory:denom_config:${FACTORY}`,
            JSON.stringify({ gasSurcharge: '0', transferFee: '0' }),
            300,
        )
        // the stored entry is what the next call reads
        getFromLocalStorageMock.mockReturnValue(setInLocalStorageMock.mock.calls[0][1])
        fetchMock.mockClear()
        await getDenomConfig(FACTORY)
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('reads zeros on an HTTP 500 without caching, so the next call asks again', async () => {
        fetchMock.mockResolvedValue(respond(500, {}))

        const config = await getDenomConfig(FACTORY)

        expect(config.gasSurcharge.isZero()).toBe(true)
        expect(setInLocalStorageMock).not.toHaveBeenCalled()

        fetchMock.mockResolvedValue(respond(200, configBody('0.500000000000000000')))
        expect((await getDenomConfig(FACTORY)).gasSurcharge.toString()).toBe('0.5')
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('reads zeros on a network error without caching, so the next call asks again', async () => {
        fetchMock.mockRejectedValueOnce(new Error('network down'))

        const config = await getDenomConfig(FACTORY)

        expect(config.gasSurcharge.isZero()).toBe(true)
        expect(setInLocalStorageMock).not.toHaveBeenCalled()

        fetchMock.mockResolvedValue(respond(200, configBody('0.5')))
        expect((await getDenomConfig(FACTORY)).gasSurcharge.toNumber()).toBe(0.5)
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('shares one request between concurrent callers', async () => {
        fetchMock.mockResolvedValue(respond(200, configBody('0.5')))

        const [a, b] = await Promise.all([getDenomConfig(FACTORY), getDenomConfig(FACTORY)])

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(a.gasSurcharge.toNumber()).toBe(0.5)
        expect(b.gasSurcharge.toNumber()).toBe(0.5)
    })

    it.each([
        ['1000', 2],
        ['3', 2],
        ['2.000000000000000001', 2],
        ['1.5', 1.5],
    ])('clamps a gas surcharge of %s to the chain maximum of 2 (%s)', async (raw, expected) => {
        fetchMock.mockResolvedValue(respond(200, configBody(raw)))

        expect((await getDenomConfig(FACTORY)).gasSurcharge.toNumber()).toBe(expected)
    })

    it('clamps a transfer fee to the chain maximum of 0.05', async () => {
        fetchMock.mockResolvedValue(respond(200, configBody('0', '0.5')))

        expect((await getDenomConfig(FACTORY)).transferFee.toNumber()).toBe(0.05)
    })

    it.each(['0x10', '-1', '1e9', 'abc', '', ' 1', 'Infinity', 'NaN'])(
        'reads zeros, logs and does not cache an invalid ratio "%s"',
        async (raw) => {
            fetchMock.mockResolvedValue(respond(200, configBody(raw)))

            const config = await getDenomConfig(FACTORY)

            expect(config.gasSurcharge.isZero()).toBe(true)
            expect(config.transferFee.isZero()).toBe(true)
            expect(console.error).toHaveBeenCalled()
            expect(setInLocalStorageMock).not.toHaveBeenCalled()
        },
    )

    it('reads zeros and does not cache a 200 without a config', async () => {
        fetchMock.mockResolvedValue(respond(200, {}))

        expect((await getDenomConfig(FACTORY)).gasSurcharge.isZero()).toBe(true)
        expect(setInLocalStorageMock).not.toHaveBeenCalled()
    })

    it('validates cached values too', async () => {
        getFromLocalStorageMock.mockReturnValue(JSON.stringify({ gasSurcharge: '1000', transferFee: '0x10' }))
        fetchMock.mockResolvedValue(respond(200, configBody('0.5')))

        const config = await getDenomConfig(FACTORY)

        // the bad cache entry is ignored and the node asked instead
        expect(config.gasSurcharge.toNumber()).toBe(0.5)
    })

    it.each(['ubze', 'ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4', ''])(
        'returns zeros for non-factory denom "%s" without a request',
        async (denom) => {
            const config = await getDenomConfig(denom)

            expect(config.gasSurcharge.isZero()).toBe(true)
            expect(config.transferFee.isZero()).toBe(true)
            expect(fetchMock).not.toHaveBeenCalled()
            expect(getFromLocalStorageMock).not.toHaveBeenCalled()
        },
    )
})

describe('getDenomConfigInfo', () => {
    const fetchMock = vi.fn()
    const POOL = 'bze1pool'

    beforeEach(() => {
        fetchMock.mockReset()
        vi.stubGlobal('fetch', fetchMock)
        settingsMock.mockReturnValue({ endpoints: { restEndpoint: REST } })
        getFromLocalStorageMock.mockReset().mockReturnValue(null)
        setInLocalStorageMock.mockReset()
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('reads the community pool and both ratios of a config', async () => {
        fetchMock.mockResolvedValue(respond(200, { config: { community_pool: POOL, transfer_fee: '0.010000000000000000', gas_surcharge: '0.500000000000000000' } }))

        const info = await getDenomConfigInfo(FACTORY)

        expect(info.status).toBe('ok')
        expect(info.communityPool).toBe(POOL)
        expect(info.transferFee.toString()).toBe('0.01')
        expect(info.gasSurcharge.toString()).toBe('0.5')
    })

    it('reads a token without a config as ok with an empty pool and zero ratios', async () => {
        fetchMock.mockResolvedValue(respond(200, configBody('0.000000000000000000')))

        const info = await getDenomConfigInfo(FACTORY)

        expect(info.status).toBe('ok')
        expect(info.communityPool).toBe('')
        expect(info.transferFee.isZero()).toBe(true)
        expect(info.gasSurcharge.isZero()).toBe(true)
    })

    it('tells a v8.2.0 node (501) apart as unsupported, and remembers it', async () => {
        fetchMock.mockResolvedValue(respond(501, { code: 12, message: 'Not Implemented' }))

        expect((await getDenomConfigInfo(FACTORY)).status).toBe('unsupported')

        const infoEntry = setInLocalStorageMock.mock.calls.find(call => String(call[0]).startsWith('tokenfactory:denom_config_info:'))
        getFromLocalStorageMock.mockImplementation((key: string) => (key === infoEntry![0] ? infoEntry![1] : null))
        fetchMock.mockClear()
        expect((await getDenomConfigInfo(FACTORY)).status).toBe('unsupported')
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('reads an HTTP 500 and a network error as error, never as unsupported', async () => {
        fetchMock.mockResolvedValueOnce(respond(500, {}))
        expect((await getDenomConfigInfo(FACTORY)).status).toBe('error')

        fetchMock.mockRejectedValueOnce(new Error('down'))
        expect((await getDenomConfigInfo(FACTORY)).status).toBe('error')
    })

    it('writes nothing on an HTTP 500, so the next call asks the node again', async () => {
        fetchMock.mockResolvedValueOnce(respond(500, {}))
        expect((await getDenomConfigInfo(FACTORY)).status).toBe('error')
        expect(setInLocalStorageMock).not.toHaveBeenCalled()

        fetchMock.mockResolvedValue(respond(200, configBody('0.000000000000000000')))
        expect((await getDenomConfigInfo(FACTORY)).status).toBe('ok')
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('does not let a fresh read join a request that started before it', async () => {
        let release: (r: Response) => void = () => {}
        fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { release = resolve }))
        const stale = getDenomConfigInfo(FACTORY)

        fetchMock.mockResolvedValueOnce(respond(200, { config: { community_pool: POOL, transfer_fee: '0.020000000000000000', gas_surcharge: '0.000000000000000000' } }))
        const fresh = await getDenomConfigInfo(FACTORY, { fresh: true })

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(fresh.communityPool).toBe(POOL)
        release(respond(200, configBody('0.000000000000000000')))
        expect((await stale).communityPool).toBe('')
    })

    it('bypasses a fresh cache with fresh: true and refreshes the ratios cache the fee engine reads', async () => {
        getFromLocalStorageMock.mockReturnValue(JSON.stringify({ status: 'ok', communityPool: '', gasSurcharge: '0', transferFee: '0' }))
        fetchMock.mockResolvedValue(respond(200, { config: { community_pool: POOL, transfer_fee: '0.020000000000000000', gas_surcharge: '0.000000000000000000' } }))

        expect((await getDenomConfigInfo(FACTORY)).communityPool).toBe('')
        expect(fetchMock).not.toHaveBeenCalled()

        const info = await getDenomConfigInfo(FACTORY, { fresh: true })

        expect(info.communityPool).toBe(POOL)
        expect(setInLocalStorageMock).toHaveBeenCalledWith(
            `tokenfactory:denom_config:${FACTORY}`,
            JSON.stringify({ gasSurcharge: '0', transferFee: '0.02' }),
            300,
        )
    })

    it('answers a non-factory denom as unsupported without a request', async () => {
        expect((await getDenomConfigInfo('ubze')).status).toBe('unsupported')
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
