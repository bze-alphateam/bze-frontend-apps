import { beforeEach, describe, expect, it, vi } from 'vitest'

// The query talks to the chain through the REST client and caches in localStorage;
// both are replaced so each test controls the wire response and the cache.
const { paramsMock, getFromLocalStorageMock, setInLocalStorageMock } = vi.hoisted(() => ({
    paramsMock: vi.fn(),
    getFromLocalStorageMock: vi.fn(),
    setInLocalStorageMock: vi.fn(),
}))

vi.mock('./client', () => ({
    getRestClient: async () => ({ bze: { txfeecollector: { params: paramsMock } } }),
}))

vi.mock('../storage/storage', () => ({
    getFromLocalStorage: getFromLocalStorageMock,
    setInLocalStorage: setInLocalStorageMock,
}))

import { getTxFeeCollectorParams } from './txfeecollector_params'

const MIN_GAS_FEE = { denom: 'ubze', amount: '0.01' }

const respond = (params: Record<string, unknown>) => paramsMock.mockResolvedValue({ params })

describe('getTxFeeCollectorParams', () => {
    beforeEach(() => {
        paramsMock.mockReset()
        getFromLocalStorageMock.mockReset().mockReturnValue(null)
        setInLocalStorageMock.mockReset()
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('reads the snake_case blocked_ibc_inbound list', async () => {
        respond({
            validator_min_gas_fee: MIN_GAS_FEE,
            blocked_ibc_inbound: [{ channel_id: 'channel-3', base_denom: 'uusdc' }],
        })

        const params = await getTxFeeCollectorParams()

        expect(params).toEqual({
            validatorMinGasFee: MIN_GAS_FEE,
            blockedIbcInbound: [{ channelId: 'channel-3', baseDenom: 'uusdc' }],
        })
    })

    it('defaults to an empty list when the field is missing (chain before v8.2.0)', async () => {
        respond({ validator_min_gas_fee: MIN_GAS_FEE })

        expect((await getTxFeeCollectorParams())?.blockedIbcInbound).toEqual([])
    })

    it('defaults to an empty list when the field is not an array', async () => {
        respond({ validator_min_gas_fee: MIN_GAS_FEE, blocked_ibc_inbound: { channel_id: 'channel-3' } })

        expect((await getTxFeeCollectorParams())?.blockedIbcInbound).toEqual([])
    })

    it('ignores malformed entries and keeps the valid ones', async () => {
        respond({
            validator_min_gas_fee: MIN_GAS_FEE,
            blocked_ibc_inbound: [
                null,
                'channel-3/uusdc',
                { channel_id: 'channel-3' },
                { base_denom: 'uusdc' },
                { channel_id: '', base_denom: 'uusdc' },
                { channel_id: 7, base_denom: 'uusdc' },
                { channelId: 'channel-3', baseDenom: 'uusdc' },
                { channel_id: 'channel-13', base_denom: 'erc20:0xabc' },
            ],
        })

        expect((await getTxFeeCollectorParams())?.blockedIbcInbound).toEqual([
            { channelId: 'channel-13', baseDenom: 'erc20:0xabc' },
        ])
    })

    // Regression: setInLocalStorage takes seconds, but the query passed 5 * 60 * 1000,
    // caching the params for ~3.5 days instead of 5 minutes — a chain-side block would
    // have stayed invisible to returning users for days.
    it('caches a successful read for five minutes', async () => {
        respond({ validator_min_gas_fee: MIN_GAS_FEE, blocked_ibc_inbound: [] })

        await getTxFeeCollectorParams()

        expect(setInLocalStorageMock).toHaveBeenCalledTimes(1)
        expect(setInLocalStorageMock).toHaveBeenCalledWith('txfeecollector_params', expect.any(String), 300)
    })

    it('serves a cached entry without hitting the chain', async () => {
        const cached = {
            validatorMinGasFee: MIN_GAS_FEE,
            blockedIbcInbound: [{ channelId: 'channel-3', baseDenom: 'uusdc' }],
        }
        getFromLocalStorageMock.mockReturnValue(JSON.stringify(cached))

        expect(await getTxFeeCollectorParams()).toEqual(cached)
        expect(paramsMock).not.toHaveBeenCalled()
    })

    it('refetches when the cached entry predates blockedIbcInbound', async () => {
        getFromLocalStorageMock.mockReturnValue(JSON.stringify({ validatorMinGasFee: MIN_GAS_FEE }))
        respond({
            validator_min_gas_fee: MIN_GAS_FEE,
            blocked_ibc_inbound: [{ channel_id: 'channel-3', base_denom: 'uusdc' }],
        })

        const params = await getTxFeeCollectorParams()

        expect(paramsMock).toHaveBeenCalledTimes(1)
        expect(params?.blockedIbcInbound).toEqual([{ channelId: 'channel-3', baseDenom: 'uusdc' }])
    })

    it('returns undefined and caches nothing when the query fails', async () => {
        paramsMock.mockRejectedValue(new Error('network down'))

        expect(await getTxFeeCollectorParams()).toBeUndefined()
        expect(setInLocalStorageMock).not.toHaveBeenCalled()
    })

    it('returns undefined and caches nothing when the min gas fee is missing', async () => {
        respond({ blocked_ibc_inbound: [{ channel_id: 'channel-3', base_denom: 'uusdc' }] })

        expect(await getTxFeeCollectorParams()).toBeUndefined()
        expect(setInLocalStorageMock).not.toHaveBeenCalled()
    })
})
