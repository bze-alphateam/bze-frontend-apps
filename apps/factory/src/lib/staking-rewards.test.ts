import { describe, expect, it } from 'vitest'
import { isStakingRewardFinished, splitStakingRewards, stakingRewardDeletion } from './staking-rewards'

const reward = (payouts: number, duration: number, staked_amount = '0') => ({ payouts, duration, staked_amount })

describe('stakingRewardDeletion', () => {
    it('is deletable once every day is paid and nothing is staked', () => {
        expect(stakingRewardDeletion(reward(30, 30))).toEqual({ kind: 'deletable' })
        // payouts past duration (chain uses >=) still counts as finished
        expect(stakingRewardDeletion(reward(31, 30))).toEqual({ kind: 'deletable' })
        expect(stakingRewardDeletion(reward(30, 30, ''))).toEqual({ kind: 'deletable' })
    })

    it('is blocked by the stake left in a finished program', () => {
        expect(stakingRewardDeletion(reward(30, 30, '1500000'))).toEqual({ kind: 'staked', stakedAmount: '1500000' })
    })

    it('is running while days are left, staked or not', () => {
        expect(stakingRewardDeletion(reward(29, 30))).toEqual({ kind: 'running' })
        expect(stakingRewardDeletion(reward(0, 30, '1000'))).toEqual({ kind: 'running' })
    })
})

describe('splitStakingRewards', () => {
    it('separates finished programs and keeps the order within each group', () => {
        const a = { id: 'a', ...reward(1, 10) }
        const b = { id: 'b', ...reward(10, 10) }
        const c = { id: 'c', ...reward(5, 10) }
        const d = { id: 'd', ...reward(12, 10, '5') }

        const { active, finished } = splitStakingRewards([a, b, c, d])

        expect(active.map(r => r.id)).toEqual(['a', 'c'])
        expect(finished.map(r => r.id)).toEqual(['b', 'd'])
        expect(isStakingRewardFinished(b)).toBe(true)
    })
})
