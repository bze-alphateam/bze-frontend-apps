import { beforeEach, describe, expect, it, vi } from 'vitest'

// The query reads the chain through bzejs' LCD client and caches in localStorage; both are
// replaced so each test controls the wire response and the cache.
const { haltedDenomsMock, getFromLocalStorageMock, setInLocalStorageMock } = vi.hoisted(() => ({
    haltedDenomsMock: vi.fn(),
    getFromLocalStorageMock: vi.fn(),
    setInLocalStorageMock: vi.fn(),
}))

vi.mock('./client', () => ({
    getRestClient: async () => ({ bze: { tradebin: { haltedDenoms: haltedDenomsMock } } }),
}))

vi.mock('../storage/storage', () => ({
    getFromLocalStorage: getFromLocalStorageMock,
    setInLocalStorage: setInLocalStorageMock,
}))

import { getHaltedDenoms } from './halted_denoms'

const USDC_N = 'ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4'
const FACTORY = 'factory/bze1creator/utoken'

describe('getHaltedDenoms', () => {
    beforeEach(() => {
        haltedDenomsMock.mockReset()
        getFromLocalStorageMock.mockReset().mockReturnValue(null)
        setInLocalStorageMock.mockReset()
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('reads a single page and caches it for five minutes', async () => {
        haltedDenomsMock.mockResolvedValue({ denoms: [USDC_N], pagination: { next_key: null, total: '1' } })

        expect(await getHaltedDenoms()).toEqual([USDC_N])
        expect(setInLocalStorageMock).toHaveBeenCalledWith('halted_denoms', JSON.stringify([USDC_N]), 300)
    })

    it('follows next_key until the last page', async () => {
        haltedDenomsMock
            .mockResolvedValueOnce({ denoms: [USDC_N], pagination: { next_key: btoa('next') } })
            .mockResolvedValueOnce({ denoms: [FACTORY], pagination: { next_key: null } })

        expect(await getHaltedDenoms()).toEqual([USDC_N, FACTORY])
        expect(haltedDenomsMock).toHaveBeenCalledTimes(2)
        const secondKey = haltedDenomsMock.mock.calls[1][0].pagination.key as Uint8Array
        expect(new TextDecoder().decode(secondKey)).toBe('next')
    })

    it('answers from a fresh cache without querying', async () => {
        getFromLocalStorageMock.mockReturnValue(JSON.stringify([FACTORY]))

        expect(await getHaltedDenoms()).toEqual([FACTORY])
        expect(getFromLocalStorageMock).toHaveBeenCalledWith('halted_denoms')
        expect(haltedDenomsMock).not.toHaveBeenCalled()
    })

    it('refetches when the cache is stale (storage returns null past the TTL)', async () => {
        haltedDenomsMock.mockResolvedValue({ denoms: [], pagination: { next_key: null } })

        expect(await getHaltedDenoms()).toEqual([])
        expect(haltedDenomsMock).toHaveBeenCalledTimes(1)
    })

    it('fails open on a network error and caches nothing', async () => {
        haltedDenomsMock.mockRejectedValue(new Error('network down'))

        expect(await getHaltedDenoms()).toEqual([])
        expect(setInLocalStorageMock).not.toHaveBeenCalled()
    })

    it('fails open on a pre-v8.2.0 node answering 501 / code 12 and caches nothing', async () => {
        haltedDenomsMock.mockRejectedValue({ response: { status: 501, data: { code: 12, message: 'Not Implemented' } } })

        expect(await getHaltedDenoms()).toEqual([])
        expect(setInLocalStorageMock).not.toHaveBeenCalled()
    })

    it('shares one request between concurrent callers', async () => {
        haltedDenomsMock.mockResolvedValue({ denoms: [USDC_N], pagination: { next_key: null } })

        const [a, b] = await Promise.all([getHaltedDenoms(), getHaltedDenoms()])
        expect(a).toEqual([USDC_N])
        expect(b).toEqual([USDC_N])
        expect(haltedDenomsMock).toHaveBeenCalledTimes(1)
    })
})
