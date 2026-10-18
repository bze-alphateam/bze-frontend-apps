import { describe, expect, it, vi } from 'vitest'
import { DenomRewardsQueries, loadDenomRewardsData } from './useDenomRewardsData'

const ADDR = 'bze1holder'
const FACTORY = 'factory/bze1creator/mytoken'

const dr = (denom: string, staked: string) => ({ staking_denom: denom, lock: 7, min_stake: '100', staked_amount: staked })
const schedule = (denom: string, prize: string, daily: string) => ({
    schedule_id: '1', staking_denom: denom, prize_denom: prize, daily_amount: daily, duration: 30, payouts: 1,
})

// The loader only sees this interface, so every chain read is a mock.
const queries = (overrides: Partial<DenomRewardsQueries> = {}): DenomRewardsQueries => ({
    getAllDenomRewards: vi.fn(async () => [dr('ubze', '5000'), dr(FACTORY, '300'), dr('uidle', '9000')]),
    getDenomRewardSchedules: vi.fn(async (denom: string) =>
        denom === 'ubze' ? [schedule('ubze', 'uusdc', '1000')] : []),
    getDenomRewardParticipations: vi.fn(async () => [{ address: ADDR, staking_denom: FACTORY, amount: '100' }]),
    getDenomRewardParticipant: vi.fn(async (_address: string, denom: string) => ({
        participant: { address: ADDR, staking_denom: denom, amount: '100' },
        pending: [{ denom: 'ubze', amount: '42' }],
    })),
    getAddressDenomRewardUnlocks: vi.fn(async () => [{ staking_denom: 'uidle', amount: '7', unlockEpoch: 500 }]),
    ...overrides,
})

describe('loadDenomRewardsData', () => {
    it('joins DRs, daily prizes, positions with the chain pending and unlocks, in holder order', async () => {
        const q = queries()
        const items = await loadDenomRewardsData(ADDR, q)

        expect(items.map(i => i.denomReward.staking_denom)).toEqual([FACTORY, 'uidle', 'ubze'])
        expect(items[0].position?.pending).toEqual([{ denom: 'ubze', amount: '42' }])
        expect(items[0].dailyPrizes).toEqual([])
        expect(items[1].unlocks).toEqual([{ staking_denom: 'uidle', amount: '7', unlockEpoch: 500 }])
        expect(items[2].dailyPrizes).toEqual([{ denom: 'uusdc', amount: '1000' }])
        expect(items[2].position).toBeUndefined()
        // pending is read per position only — never for DRs the address is not in
        expect(q.getDenomRewardParticipant).toHaveBeenCalledTimes(1)
        expect(q.getDenomRewardParticipant).toHaveBeenCalledWith(ADDR, FACTORY)
    })

    it('reads no address data without an address', async () => {
        const q = queries()
        const items = await loadDenomRewardsData(undefined, q)

        expect(items.every(i => !i.position && i.unlocks.length === 0)).toBe(true)
        expect(q.getDenomRewardParticipations).not.toHaveBeenCalled()
        expect(q.getAddressDenomRewardUnlocks).not.toHaveBeenCalled()
    })

    it('marks daily prizes unknown when a schedules read fails, keeping the rest', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const q = queries({
            getDenomRewardSchedules: vi.fn(async (denom: string) => {
                if (denom === 'ubze') throw new Error('boom')
                return []
            }),
        })
        const items = await loadDenomRewardsData(ADDR, q)

        expect(items.find(i => i.denomReward.staking_denom === 'ubze')?.dailyPrizes).toBeUndefined()
        expect(items.find(i => i.denomReward.staking_denom === FACTORY)?.dailyPrizes).toEqual([])
    })

    it('keeps the list when the position reads fail', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const q = queries({ getDenomRewardParticipations: vi.fn(async () => { throw new Error('down') }) })
        const items = await loadDenomRewardsData(ADDR, q)

        expect(items).toHaveLength(3)
        expect(items.every(i => !i.position)).toBe(true)
    })

    it('throws when the DR list cannot be read', async () => {
        const q = queries({ getAllDenomRewards: vi.fn(async () => { throw new Error('501') }) })
        await expect(loadDenomRewardsData(ADDR, q)).rejects.toThrow('501')
    })
})
