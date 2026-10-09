import { describe, expect, it, vi } from 'vitest'
import { loadTokenDenomReward, TokenDenomRewardQueries } from './useTokenDenomReward'

const ADDR = 'bze1holder'
const TOKEN = 'factory/bze1creator/mytoken'

const dr = { staking_denom: TOKEN, lock: 7, min_stake: '100', staked_amount: '5000' }
const schedule = (prize: string, daily: string) => ({
    schedule_id: '1', staking_denom: TOKEN, prize_denom: prize, daily_amount: daily, duration: 30, payouts: 1,
})
const prize = (prizeDenom: string) => ({ staking_denom: TOKEN, prize_denom: prizeDenom, distributed_stake: '0', last_distribution_epoch: '0' })

// The loader only sees this interface, so every chain read is a mock.
const queries = (overrides: Partial<TokenDenomRewardQueries> = {}): TokenDenomRewardQueries => ({
    getDenomReward: vi.fn(async () => dr),
    getDenomRewardSchedules: vi.fn(async () => [schedule('uusdc', '1000'), schedule('ubze', '30')]),
    getDenomRewardPrizes: vi.fn(async () => [prize('ubze'), prize('uusdc'), prize('uatom')]),
    getDenomRewardParticipant: vi.fn(async () => ({
        participant: { address: ADDR, staking_denom: TOKEN, amount: '100' },
        pending: [{ denom: 'ubze', amount: '42' }],
    })),
    getAddressDenomRewardUnlocks: vi.fn(async () => [
        { staking_denom: TOKEN, amount: '7', unlockEpoch: 500 },
        { staking_denom: 'uother', amount: '9', unlockEpoch: 600 },
    ]),
    ...overrides,
})

describe('loadTokenDenomReward', () => {
    it('joins the DR, its daily prizes, the prize denoms, my position and only its own unlocks', async () => {
        const q = queries()
        const { item, prizeDenoms } = await loadTokenDenomReward(TOKEN, ADDR, q)

        expect(item?.denomReward).toEqual(dr)
        expect(item?.dailyPrizes).toEqual([{ denom: 'uusdc', amount: '1000' }, { denom: 'ubze', amount: '30' }])
        expect(item?.position?.pending).toEqual([{ denom: 'ubze', amount: '42' }])
        expect(item?.unlocks).toEqual([{ staking_denom: TOKEN, amount: '7', unlockEpoch: 500 }])
        expect(prizeDenoms).toEqual(['ubze', 'uusdc', 'uatom'])
        expect(q.getDenomRewardParticipant).toHaveBeenCalledWith(ADDR, TOKEN)
    })

    it('returns no item, and reads nothing else, when the token has no DR', async () => {
        const q = queries({ getDenomReward: vi.fn(async () => undefined) })
        expect(await loadTokenDenomReward(TOKEN, ADDR, q)).toEqual({ prizeDenoms: [] })
        expect(q.getDenomRewardSchedules).not.toHaveBeenCalled()
        expect(q.getDenomRewardParticipant).not.toHaveBeenCalled()
    })

    it('reads no address data without an address', async () => {
        const q = queries()
        const { item } = await loadTokenDenomReward(TOKEN, undefined, q)

        expect(item?.position).toBeUndefined()
        expect(item?.unlocks).toEqual([])
        expect(q.getDenomRewardParticipant).not.toHaveBeenCalled()
        expect(q.getAddressDenomRewardUnlocks).not.toHaveBeenCalled()
    })

    it('keeps the DR when the side reads fail', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const down = async () => { throw new Error('down') }
        const { item, prizeDenoms } = await loadTokenDenomReward(TOKEN, ADDR, queries({
            getDenomRewardSchedules: vi.fn(down),
            getDenomRewardPrizes: vi.fn(down),
            getDenomRewardParticipant: vi.fn(down),
        }))

        expect(item?.denomReward).toEqual(dr)
        expect(item?.dailyPrizes).toBeUndefined()
        expect(item?.position).toBeUndefined()
        expect(item?.unlocks).toEqual([])
        expect(prizeDenoms).toEqual([])
    })

    it('throws when the DR itself cannot be read', async () => {
        const q = queries({ getDenomReward: vi.fn(async () => { throw new Error('501') }) })
        await expect(loadTokenDenomReward(TOKEN, ADDR, q)).rejects.toThrow('501')
    })
})
