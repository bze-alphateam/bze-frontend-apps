import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The same IBC coin, with a trace unknown to the registry, is resolved against a v8.2.0 node (old
// denom_traces route) and a v8.3.0 node (ibc-go v10 denoms route). Only the node's HTTP answers
// differ, so the asset that comes out must be identical. query/ibc is the real one here.
const { getAllSupplyMock, getAssetListsMock, getIBCAssetListMock } = vi.hoisted(() => ({
    getAllSupplyMock: vi.fn(),
    getAssetListsMock: vi.fn(),
    getIBCAssetListMock: vi.fn(),
}))

vi.mock('../query/supply', () => ({
    getAllSupply: () => getAllSupplyMock(),
    getAllSupplyMetadata: async () => [],
}))
vi.mock('../query/liquidity_pools', () => ({ getLiquidityPools: async () => [] }))
vi.mock('../query/halted_denoms', () => ({ getHaltedDenoms: async () => [] }))
vi.mock('../constants/chain', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../constants/chain')>()),
    getAssetLists: () => getAssetListsMock(),
    getIBCAssetList: () => getIBCAssetListMock(),
}))

import { getChainAssets } from './assets_factory'

const DENOM = 'ibc/9DA252F9F9C86132CC282EA431DFB7DE7729501F6DC9A3E0F50EC8C6EE380CC7'
const HASH = DENOM.replace('ibc/', '')

const json = (status: number, body: unknown) => ({ status, ok: status >= 200 && status < 300, json: async () => body }) as Response

// Everything under /ibc/ is answered here; BZE Scan and any other host is down.
const stubNode = (version: 'v8' | 'v10') => {
    const fetchMock = vi.fn(async (url: string) => {
        if (url.includes(`/ibc/apps/transfer/v1/denoms/${HASH}`)) {
            return version === 'v10'
                ? json(200, { denom: { base: 'ulmn', trace: [{ port_id: 'transfer', channel_id: 'channel-0' }] } })
                : json(501, { code: 12, message: 'Not Implemented' })
        }
        if (url.includes(`/ibc/apps/transfer/v1/denom_traces/${HASH}`)) {
            return version === 'v8'
                ? json(200, { denom_trace: { path: 'transfer/channel-0', base_denom: 'ulmn' } })
                : json(501, { code: 12, message: 'Not Implemented' })
        }
        if (url.includes('/ibc/core/channel/v1/channels/channel-0/ports/transfer')) {
            return json(200, { channel: { connection_hops: ['connection-0'], counterparty: { channel_id: 'channel-9' } } })
        }
        if (url.includes('/ibc/core/connection/v1/connections/connection-0')) {
            return json(200, { connection: { client_id: '07-tendermint-0' } })
        }
        if (url.includes('/ibc/core/client/v1/client_states/07-tendermint-0')) {
            return json(200, { client_state: { chain_id: 'osmosis-1' } })
        }
        throw new TypeError('fetch failed')
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

const resolve = async () => {
    const { assets } = await getChainAssets()
    return assets.get(DENOM)
}

describe('getChainAssets IBC coin resolved through either denom route', () => {
    beforeEach(() => {
        getAllSupplyMock.mockResolvedValue([{ denom: DENOM, amount: '1000' }])
        getAssetListsMock.mockReturnValue([])
        getIBCAssetListMock.mockReturnValue([])
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('builds the same asset from a v10 answer as from a v8 answer', async () => {
        const v8Fetch = stubNode('v8')
        const fromV8 = await resolve()
        const v8Urls = v8Fetch.mock.calls.map(([url]) => url)
        expect(v8Urls.some(u => u.includes(`/ibc/apps/transfer/v1/denom_traces/${HASH}`))).toBe(true)

        const v10Fetch = stubNode('v10')
        const fromV10 = await resolve()
        const v10Urls = v10Fetch.mock.calls.map(([url]) => url)
        expect(v10Urls.some(u => u.includes(`/ibc/apps/transfer/v1/denoms/${HASH}`))).toBe(true)
        expect(v10Urls.some(u => u.includes('/denom_traces/'))).toBe(false)

        expect(fromV8?.IBCData?.chain.channelId).toBe('channel-0')
        expect(fromV8?.IBCData?.counterparty.baseDenom).toBe('ulmn')
        expect(fromV10).toEqual(fromV8)
    })
})
