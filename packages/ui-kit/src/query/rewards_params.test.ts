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
    // moved to _v2 so entries written with the long expiry are ignored, then to _v3
    // when the Denom Rewards fields joined the cached shape (BFE-70).
    it('caches a successful read for five minutes under the v3 key', async () => {
        paramsMock.mockResolvedValue({ params: PARAMS })

        expect(await getRewardsParams()).toEqual(PARAMS)
        expect(setInLocalStorageMock).toHaveBeenCalledTimes(1)
        expect(setInLocalStorageMock).toHaveBeenCalledWith('rewards_params_v3', JSON.stringify(PARAMS), 300)
    })

    it('reads the cache from the v3 key', async () => {
        getFromLocalStorageMock.mockReturnValue(JSON.stringify(PARAMS))

        expect(await getRewardsParams()).toEqual(PARAMS)
        expect(getFromLocalStorageMock).toHaveBeenCalledWith('rewards_params_v3')
        expect(paramsMock).not.toHaveBeenCalled()
    })

    // The REST gateway names the fields after the proto declarations (camelCase), not after the
    // gogoproto jsontags (snake_case) — what rest.getbze.com returns for the existing fees too.
    it('parses the Denom Rewards params of a v8.2.0 node', async () => {
        paramsMock.mockResolvedValue({
            params: {
                ...PARAMS,
                extraGasForExitStake: '1000000',
                createDenomRewardFee: { denom: 'ubze', amount: '25000000000' },
                createDenomRewardPrizeFee: { denom: 'ubze', amount: '25000000000' },
                addDenomRewardScheduleFee: { denom: 'ubze', amount: '25000000000' },
                maxPrizeDenomsPerDr: 50,
                extraGasForDenomExit: '1000000',
                denomRewardLock: 7,
                denomRewardMinStake: '0',
            },
        })

        expect(await getRewardsParams()).toEqual({
            ...PARAMS,
            createDenomRewardFee: { denom: 'ubze', amount: '25000000000' },
            createDenomRewardPrizeFee: { denom: 'ubze', amount: '25000000000' },
            addDenomRewardScheduleFee: { denom: 'ubze', amount: '25000000000' },
            maxPrizeDenomsPerDr: 50,
            extraGasForDenomExit: '1000000',
            denomRewardLock: 7,
            denomRewardMinStake: '0',
        })
    })

    it('still returns the staking/trading fees from a pre-v8.2.0 node, Denom Rewards fields unknown', async () => {
        paramsMock.mockResolvedValue({ params: { ...PARAMS, extraGasForExitStake: '1000000' } })

        const params = await getRewardsParams()

        expect(params?.createStakingRewardFee).toEqual(PARAMS.createStakingRewardFee)
        expect(params?.createDenomRewardFee).toBeUndefined()
        expect(params?.maxPrizeDenomsPerDr).toBeUndefined()
        expect(params?.denomRewardLock).toBeUndefined()
    })

    it('returns undefined and caches nothing when the query fails', async () => {
        paramsMock.mockRejectedValue(new Error('network down'))

        expect(await getRewardsParams()).toBeUndefined()
        expect(setInLocalStorageMock).not.toHaveBeenCalled()
    })
})
