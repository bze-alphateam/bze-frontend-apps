import { describe, expect, it, vi } from 'vitest'

const { participantMock, pendingMock } = vi.hoisted(() => ({
    participantMock: vi.fn(),
    pendingMock: vi.fn(),
}))

vi.mock('./client', () => ({
    getRestClient: async () => ({
        bze: { rewards: { stakingRewardParticipant: participantMock, allPendingUnlockParticipants: pendingMock } },
    }),
}))

import { getAddressStakingRewards } from './rewards'

const HOLDER = 'bze1holder'

describe('getAddressStakingRewards', () => {
    // Regression (BFE-74): denom reward exits share the pending-unlock store under
    // `<epoch>/dr/<denom>/<address>`; they must not break or pollute the staking reward unlocks.
    it('groups staking reward unlocks by reward id and leaves denom reward entries out', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        participantMock.mockResolvedValue({ list: [] })
        pendingMock.mockResolvedValue({
            list: [
                { index: `1200/0007/${HOLDER}`, address: HOLDER, amount: '5', denom: 'ubze' },
                { index: `1368/dr/ubze/${HOLDER}`, address: HOLDER, amount: '9', denom: 'ubze' },
                { index: `1368/dr/factory/bze1c/tok/${HOLDER}`, address: HOLDER, amount: '9', denom: 'factory/bze1c/tok' },
            ],
        })

        const result = await getAddressStakingRewards(HOLDER)

        expect(Array.from(result.unlocking.keys())).toEqual(['0007'])
        expect(result.unlocking.get('0007')?.[0].unlockEpoch.toNumber()).toBe(1200)
        expect(error).not.toHaveBeenCalled()
    })
})
