import { beforeEach, describe, expect, it, vi } from 'vitest'

// The queries go through bzejs' LCD client; the client is replaced so each test controls the
// wire response and can inspect the request (denom as query param, pagination key).
const {
    denomRewardMock, denomRewardAllMock, denomRewardPrizesMock, denomRewardSchedulesMock,
    denomRewardParticipantMock, denomRewardParticipationsMock, pendingUnlockMock,
} = vi.hoisted(() => ({
    denomRewardMock: vi.fn(),
    denomRewardAllMock: vi.fn(),
    denomRewardPrizesMock: vi.fn(),
    denomRewardSchedulesMock: vi.fn(),
    denomRewardParticipantMock: vi.fn(),
    denomRewardParticipationsMock: vi.fn(),
    pendingUnlockMock: vi.fn(),
}))

vi.mock('./rewards', () => ({ getAddressPendingUnlock: pendingUnlockMock }))

vi.mock('./client', () => ({
    getRestClient: async () => ({
        bze: {
            rewards: {
                denomReward: denomRewardMock,
                denomRewardAll: denomRewardAllMock,
                denomRewardPrizes: denomRewardPrizesMock,
                denomRewardSchedules: denomRewardSchedulesMock,
                denomRewardParticipant: denomRewardParticipantMock,
                denomRewardParticipations: denomRewardParticipationsMock,
            },
        },
    }),
}))

import {
    getAddressDenomRewardUnlocks,
    getDenomRewardParticipant,
    getDenomRewardParticipations,
    getAllDenomRewards,
    getDenomReward,
    getDenomRewardPrizes,
    getDenomRewardSchedules,
} from './denom_rewards'

const FACTORY_DENOM = 'factory/bze1creator/mytoken'

const DR = { staking_denom: FACTORY_DENOM, lock: 7, min_stake: '0', staked_amount: '1500000' }

const schedule = (id: string) => ({
    schedule_id: id,
    staking_denom: FACTORY_DENOM,
    prize_denom: 'ubze',
    daily_amount: '1000000',
    duration: 30,
    payouts: 4,
})

// An axios-style rejection, as the LCD client surfaces it.
const httpError = (status: number, code: number) =>
    Object.assign(new Error(`Request failed with status code ${status}`), {
        response: { status, data: { code, message: 'x', details: [] } },
    })

describe('getDenomReward', () => {
    beforeEach(() => { denomRewardMock.mockReset() })

    it('passes the denom as the query param (not a path segment) and returns the record', async () => {
        denomRewardMock.mockResolvedValue({ denom_reward: DR })

        expect(await getDenomReward(FACTORY_DENOM)).toEqual(DR)
        expect(denomRewardMock).toHaveBeenCalledWith({ denom: FACTORY_DENOM })
    })

    it('returns undefined when the denom has no denom reward (gRPC NotFound → HTTP 404)', async () => {
        denomRewardMock.mockRejectedValue(httpError(404, 5))

        expect(await getDenomReward(FACTORY_DENOM)).toBeUndefined()
    })

    it('throws on any other failure so an error is never shown as "no denom reward"', async () => {
        // a node older than v8.2.0 answers 501 Not Implemented
        denomRewardMock.mockRejectedValue(httpError(501, 12))

        await expect(getDenomReward(FACTORY_DENOM)).rejects.toThrow('501')
    })
})

describe('getDenomRewardSchedules', () => {
    beforeEach(() => { denomRewardSchedulesMock.mockReset() })

    it('follows pagination.next_key until the last page', async () => {
        denomRewardSchedulesMock
            .mockResolvedValueOnce({ list: [schedule('001')], pagination: { next_key: 'AAE=' } })
            .mockResolvedValueOnce({ list: [schedule('002')], pagination: { next_key: null } })

        const list = await getDenomRewardSchedules(FACTORY_DENOM)

        expect(list.map(s => s.schedule_id)).toEqual(['001', '002'])
        expect(denomRewardSchedulesMock).toHaveBeenCalledTimes(2)

        const first = denomRewardSchedulesMock.mock.calls[0][0]
        expect(first.denom).toBe(FACTORY_DENOM)
        expect(first.pagination.key).toHaveLength(0)

        // the base64 next_key goes back as the bytes the LCD client re-encodes
        const second = denomRewardSchedulesMock.mock.calls[1][0]
        expect(second.denom).toBe(FACTORY_DENOM)
        expect(Array.from(second.pagination.key)).toEqual([0, 1])
    })

    it('treats a missing list as empty', async () => {
        denomRewardSchedulesMock.mockResolvedValue({ pagination: {} })

        expect(await getDenomRewardSchedules(FACTORY_DENOM)).toEqual([])
    })

    it('propagates a failed query', async () => {
        denomRewardSchedulesMock.mockRejectedValue(httpError(501, 12))

        await expect(getDenomRewardSchedules(FACTORY_DENOM)).rejects.toThrow()
    })
})

describe('getAllDenomRewards', () => {
    beforeEach(() => { denomRewardAllMock.mockReset() })

    it('collects every page', async () => {
        denomRewardAllMock
            .mockResolvedValueOnce({ list: [DR], pagination: { next_key: 'AQ==' } })
            .mockResolvedValueOnce({ list: [{ ...DR, staking_denom: 'ubze' }], pagination: {} })

        const list = await getAllDenomRewards()

        expect(list.map(d => d.staking_denom)).toEqual([FACTORY_DENOM, 'ubze'])
    })
})

describe('getDenomRewardPrizes', () => {
    beforeEach(() => { denomRewardPrizesMock.mockReset() })

    it('passes the denom as the query param and returns the list', async () => {
        const prize = { staking_denom: FACTORY_DENOM, prize_denom: 'ubze', distributed_stake: '0', last_distribution_epoch: '0' }
        denomRewardPrizesMock.mockResolvedValue({ list: [prize] })

        expect(await getDenomRewardPrizes(FACTORY_DENOM)).toEqual([prize])
        expect(denomRewardPrizesMock).toHaveBeenCalledWith({ denom: FACTORY_DENOM })
    })
})

const HOLDER = 'bze1holder'

describe('getDenomRewardParticipant', () => {
    beforeEach(() => { denomRewardParticipantMock.mockReset() })

    it('passes the address as path and the denom as query param, returning position + pending', async () => {
        const participant = { address: HOLDER, staking_denom: FACTORY_DENOM, amount: '500' }
        denomRewardParticipantMock.mockResolvedValue({ participant, pending: [{ denom: 'ubze', amount: '12' }] })

        expect(await getDenomRewardParticipant(HOLDER, FACTORY_DENOM))
            .toEqual({ participant, pending: [{ denom: 'ubze', amount: '12' }] })
        expect(denomRewardParticipantMock).toHaveBeenCalledWith({ address: HOLDER, denom: FACTORY_DENOM })
    })

    it('defaults a missing pending (omitempty) to an empty list', async () => {
        const participant = { address: HOLDER, staking_denom: FACTORY_DENOM, amount: '500' }
        denomRewardParticipantMock.mockResolvedValue({ participant })

        expect((await getDenomRewardParticipant(HOLDER, FACTORY_DENOM))?.pending).toEqual([])
    })

    it('returns undefined when the address has no position (404 / code 5)', async () => {
        denomRewardParticipantMock.mockRejectedValue(httpError(404, 5))
        expect(await getDenomRewardParticipant(HOLDER, FACTORY_DENOM)).toBeUndefined()
    })

    it('throws on any other failure', async () => {
        denomRewardParticipantMock.mockRejectedValue(httpError(501, 12))
        await expect(getDenomRewardParticipant(HOLDER, FACTORY_DENOM)).rejects.toThrow()
    })
})

describe('getDenomRewardParticipations', () => {
    beforeEach(() => { denomRewardParticipationsMock.mockReset() })

    it('follows next_key across pages', async () => {
        const p = (denom: string) => ({ address: HOLDER, staking_denom: denom, amount: '1' })
        denomRewardParticipationsMock
            .mockResolvedValueOnce({ list: [p('ubze')], pagination: { next_key: btoa('k') } })
            .mockResolvedValueOnce({ list: [p(FACTORY_DENOM)], pagination: { next_key: null } })

        expect(await getDenomRewardParticipations(HOLDER)).toEqual([p('ubze'), p(FACTORY_DENOM)])
        expect(denomRewardParticipationsMock.mock.calls[0][0].address).toBe(HOLDER)
    })
})

describe('getAddressDenomRewardUnlocks', () => {
    beforeEach(() => { pendingUnlockMock.mockReset() })

    it('keeps only the denom reward entries of the shared pending-unlock store', async () => {
        pendingUnlockMock.mockResolvedValue([
            { index: `1200/0007/${HOLDER}`, address: HOLDER, amount: '5', denom: 'ubze' },
            { index: `1368/dr/${FACTORY_DENOM}/${HOLDER}`, address: HOLDER, amount: '900', denom: FACTORY_DENOM },
        ])

        expect(await getAddressDenomRewardUnlocks(HOLDER))
            .toEqual([{ staking_denom: FACTORY_DENOM, amount: '900', unlockEpoch: 1368 }])
    })

    it('reads nothing without an address', async () => {
        expect(await getAddressDenomRewardUnlocks('')).toEqual([])
        expect(pendingUnlockMock).not.toHaveBeenCalled()
    })
})
