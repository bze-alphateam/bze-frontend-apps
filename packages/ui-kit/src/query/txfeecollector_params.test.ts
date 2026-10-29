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

// The LCD payload exactly as mainnet and testnet return it: the params message has no
// json tags (PascalCase Go names), only the nested Coin / BlockedIbcInbound are snake_case.
const LIVE_PARAMS = {
    ValidatorMinGasFee: { denom: 'ubze', amount: '0.010000000000000000' },
    MaxBalanceIterations: '100',
    BlockedIbcInbound: [{ channel_id: 'channel-3', base_denom: 'uusdc' }],
}
const MIN_GAS_FEE = LIVE_PARAMS.ValidatorMinGasFee

const respond = (params: Record<string, unknown>) => paramsMock.mockResolvedValue({ params })

describe('getTxFeeCollectorParams', () => {
    beforeEach(() => {
        paramsMock.mockReset()
        getFromLocalStorageMock.mockReset().mockReturnValue(null)
        setInLocalStorageMock.mockReset()
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    // Regression: the parser read snake_case top-level keys, which the chain never sends,
    // so it always returned undefined — the gas price fell back to the env default (0.02
    // instead of the chain's 0.01) and the blocked IBC list was never applied.
    it('parses the live PascalCase payload', async () => {
        respond(LIVE_PARAMS)

        const params = await getTxFeeCollectorParams()

        expect(params).toEqual({
            validatorMinGasFee: { denom: 'ubze', amount: '0.010000000000000000' },
            blockedIbcInbound: [{ channelId: 'channel-3', baseDenom: 'uusdc' }],
        })
    })

    it('still accepts snake_case top-level keys as a fallback', async () => {
        respond({
            validator_min_gas_fee: MIN_GAS_FEE,
            blocked_ibc_inbound: [{ channel_id: 'channel-3', base_denom: 'uusdc' }],
        })

        expect(await getTxFeeCollectorParams()).toEqual({
            validatorMinGasFee: MIN_GAS_FEE,
            blockedIbcInbound: [{ channelId: 'channel-3', baseDenom: 'uusdc' }],
        })
    })

    it('defaults to an empty list when the field is missing (chain before v8.2.0)', async () => {
        respond({ ValidatorMinGasFee: MIN_GAS_FEE, MaxBalanceIterations: '100' })

        expect((await getTxFeeCollectorParams())?.blockedIbcInbound).toEqual([])
    })

    it('defaults to an empty list when the field is not an array', async () => {
        respond({ ValidatorMinGasFee: MIN_GAS_FEE, BlockedIbcInbound: { channel_id: 'channel-3' } })

        expect((await getTxFeeCollectorParams())?.blockedIbcInbound).toEqual([])
    })

    it('ignores malformed entries and keeps the valid ones', async () => {
        respond({
            ValidatorMinGasFee: MIN_GAS_FEE,
            BlockedIbcInbound: [
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
        respond(LIVE_PARAMS)

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
        respond(LIVE_PARAMS)

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
        respond({ MaxBalanceIterations: '100', BlockedIbcInbound: [{ channel_id: 'channel-3', base_denom: 'uusdc' }] })

        expect(await getTxFeeCollectorParams()).toBeUndefined()
        expect(setInLocalStorageMock).not.toHaveBeenCalled()
    })
})
