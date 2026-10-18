import { beforeEach, describe, expect, it, vi } from 'vitest'

// The raffle list comes from bzejs' LCD client, replaced so each test controls the answer.
const { rafflesMock } = vi.hoisted(() => ({ rafflesMock: vi.fn() }))

vi.mock('./client', () => ({
    getRestClient: async () => ({ bze: { burner: { raffles: rafflesMock } } }),
}))

import { getRaffles, getRafflesOrThrow } from './raffle'

const RAFFLE = { denom: 'factory/bze1creator/utoken', pot: '100000', end_at: BigInt(10) }

describe('raffle queries', () => {
    beforeEach(() => {
        rafflesMock.mockReset()
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('both return the running raffles', async () => {
        rafflesMock.mockResolvedValue({ list: [RAFFLE] })

        expect(await getRafflesOrThrow()).toEqual([RAFFLE])
        expect(await getRaffles()).toEqual([RAFFLE])
    })

    it('getRafflesOrThrow passes a failed query on, getRaffles answers []', async () => {
        rafflesMock.mockRejectedValue(new Error('node down'))

        await expect(getRafflesOrThrow()).rejects.toThrow('node down')
        expect(await getRaffles()).toEqual([])
    })
})
