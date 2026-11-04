import { beforeEach, describe, expect, it, vi } from 'vitest'

// The raffle list comes from bzejs' LCD client, replaced so each test controls the answer.
const { rafflesMock, blockResultsMock } = vi.hoisted(() => ({ rafflesMock: vi.fn(), blockResultsMock: vi.fn() }))

vi.mock('./client', () => ({
    getRestClient: async () => ({ bze: { burner: { raffles: rafflesMock } } }),
}))

vi.mock('./block', () => ({ getBlockResults: blockResultsMock }))

import { checkAddressWonRaffle, getRaffles, getRafflesOrThrow } from './raffle'

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

// finalize_block_events of testnet block 4,083,545 (trimmed): the ticket of a join at 4,083,543 won.
const CTR = 'factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/uctr'
const PLAYER = 'bze1fkj4ngtlqcxs83q360fl6f8jn8phzh4y6y3y5k'
const attr = (key: string, value: string) => ({ key, value, index: true })
const WON = {
    type: 'bze.burner.RaffleWinnerEvent',
    attributes: [attr('amount', '"91840000"'), attr('denom', `"${CTR}"`), attr('winner', `"${PLAYER}"`), attr('mode', 'EndBlock')],
}
const lost = (denom: string) => ({
    type: 'bze.burner.RaffleLostEvent',
    attributes: [attr('denom', `"${denom}"`), attr('participant', `"${PLAYER}"`), attr('mode', 'EndBlock')],
})
const block = (...events: unknown[]) => ({ result: { height: '4083545', finalize_block_events: events } })

describe('checkAddressWonRaffle', () => {
    beforeEach(() => blockResultsMock.mockReset())

    it('reads a win from the block the ticket was drawn in', async () => {
        blockResultsMock.mockResolvedValue(block(WON))

        expect(await checkAddressWonRaffle(PLAYER, CTR, 4083545)).toEqual({ hasWon: true, amount: '91840000', denom: CTR, address: PLAYER })
        expect(blockResultsMock).toHaveBeenCalledWith(4083545)
    })

    it('reads a loss of this raffle', async () => {
        blockResultsMock.mockResolvedValue(block(lost(CTR)))

        expect(await checkAddressWonRaffle(PLAYER, CTR, 4083545)).toMatchObject({ hasWon: false, amount: '0' })
    })

    it("doesn't take a loss in another token's raffle in the same block for this one", async () => {
        blockResultsMock.mockResolvedValue(block(lost('factory/bze1other/uother'), WON))

        expect(await checkAddressWonRaffle(PLAYER, CTR, 4083545)).toMatchObject({ hasWon: true, amount: '91840000' })
    })

    it('answers undefined for a block the node has not processed yet', async () => {
        blockResultsMock.mockResolvedValue(undefined)

        expect(await checkAddressWonRaffle(PLAYER, CTR, 4083546)).toBeUndefined()
    })
})
