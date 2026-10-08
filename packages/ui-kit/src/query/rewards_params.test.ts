import { beforeEach, describe, expect, it, vi } from 'vitest'

// The query talks to the chain through the REST client and caches in localStorage;
// both are replaced so each test controls the wire response and the cache.
const { paramsMock, getFromLocalStorageMock, setInLocalStorageMock } = vi.hoisted(() => ({
    paramsMock: vi.fn(),
    getFromLocalStorageMock: vi.fn(),
    setInLocalStorageMock: vi.fn(),
}))

vi.mock('./client', () => ({
    getRestClient: async () => ({ bze: { rewards: { params: paramsMock } } }),
}))

vi.mock('../storage/storage', () => ({
    getFromLocalStorage: getFromLocalStorageMock,
    setInLocalStorage: setInLocalStorageMock,
}))

import { getRewardsParams } from './rewards_params'

const PARAMS = {
    createStakingRewardFee: { denom: 'ubze', amount: '10000000000' },
    createTradingRewardFee: { denom: 'ubze', amount: '5000000000' },
}

describe('getRewardsParams', () => {
    beforeEach(() => {
        paramsMock.mockReset()
        getFromLocalStorageMock.mockReset().mockReturnValue(null)
        setInLocalStorageMock.mockReset()
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    // Regression (BFE-105): setInLocalStorage takes seconds, but the query passed
    // 5 * 60 * 1000, caching the params for ~3.5 days instead of 5 minutes. The key
    // moved to _v2 so entries written with the long expiry are ignored.
    it('caches a successful read for five minutes under the v2 key', async () => {
        paramsMock.mockResolvedValue({ params: PARAMS })

        expect(await getRewardsParams()).toEqual(PARAMS)
        expect(setInLocalStorageMock).toHaveBeenCalledTimes(1)
        expect(setInLocalStorageMock).toHaveBeenCalledWith('rewards_params_v2', JSON.stringify(PARAMS), 300)
    })

    it('reads the cache from the v2 key', async () => {
        getFromLocalStorageMock.mockReturnValue(JSON.stringify(PARAMS))

        expect(await getRewardsParams()).toEqual(PARAMS)
        expect(getFromLocalStorageMock).toHaveBeenCalledWith('rewards_params_v2')
        expect(paramsMock).not.toHaveBeenCalled()
    })

    it('returns undefined and caches nothing when the query fails', async () => {
        paramsMock.mockRejectedValue(new Error('network down'))

        expect(await getRewardsParams()).toBeUndefined()
        expect(setInLocalStorageMock).not.toHaveBeenCalled()
    })
})
