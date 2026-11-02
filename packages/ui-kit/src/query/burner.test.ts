import { beforeEach, describe, expect, it, vi } from 'vitest'

// The burned coins list comes from bzejs' LCD client and the cache from localStorage helpers, replaced so each test controls them.
const { allBurnedCoinsMock, getLocalMock, setLocalMock } = vi.hoisted(() => ({
    allBurnedCoinsMock: vi.fn(),
    getLocalMock: vi.fn(),
    setLocalMock: vi.fn(),
}))

vi.mock('./client', () => ({
    getRestClient: async () => ({ bze: { burner: { allBurnedCoins: allBurnedCoinsMock } } }),
}))
vi.mock('../storage/storage', () => ({
    getFromLocalStorage: getLocalMock,
    setInLocalStorage: setLocalMock,
}))

import { getAllBurnedCoins } from './burner'

describe('getAllBurnedCoins', () => {
    beforeEach(() => {
        allBurnedCoinsMock.mockReset()
        getLocalMock.mockReset().mockReturnValue(null)
        setLocalMock.mockReset()
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('asks the chain for up to 500 records, newest first', async () => {
        allBurnedCoinsMock.mockResolvedValue({ burnedCoins: [] })

        await getAllBurnedCoins()

        expect(allBurnedCoinsMock).toHaveBeenCalledTimes(1)
        const request = allBurnedCoinsMock.mock.calls[0][0]
        expect(request.pagination.limit).toBe(BigInt(500))
        expect(request.pagination.reverse).toBe(true)
    })

    it('caches the response and serves it from the cache next time', async () => {
        const response = { burnedCoins: [{ burned: '1ubze' }] }
        allBurnedCoinsMock.mockResolvedValue(response)

        expect(await getAllBurnedCoins()).toEqual(response)
        expect(setLocalMock).toHaveBeenCalledWith('burner:all_burned_coins', JSON.stringify(response), expect.any(Number))

        getLocalMock.mockReturnValue(JSON.stringify(response))
        allBurnedCoinsMock.mockClear()
        expect(await getAllBurnedCoins()).toEqual(response)
        expect(allBurnedCoinsMock).not.toHaveBeenCalled()
    })

    it('answers an empty list when the query fails', async () => {
        allBurnedCoinsMock.mockRejectedValue(new Error('node down'))

        expect(await getAllBurnedCoins()).toEqual({ burnedCoins: [] })
    })
})
