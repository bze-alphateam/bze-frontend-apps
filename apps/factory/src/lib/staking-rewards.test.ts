import { describe, expect, it } from 'vitest'
import { isStakingRewardFinished, programInvolves, splitStakingRewards, stakingRewardDeletion } from './staking-rewards'

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

describe('programInvolves', () => {
    const TOK = 'factory/bze1owner/utok'
    const program = (staking_denom: string, prize_denom: string) => ({ staking_denom, prize_denom })
    const pools = [
        { lp_denom: 'ulp_tok_bze', base: TOK, quote: 'ubze' },
        { lp_denom: 'ulp_usdc_tok', base: 'uusdc', quote: TOK },
        { lp_denom: 'ulp_usdc_bze', base: 'uusdc', quote: 'ubze' },
    ]

    it('is true when people stake the denom', () => {
        expect(programInvolves(program(TOK, 'ubze'), TOK, pools)).toBe(true)
    })

    it('is true when people earn the denom', () => {
        expect(programInvolves(program('ubze', TOK), TOK, pools)).toBe(true)
    })

    it('is true for the LP token of a pool with the denom as base or as quote', () => {
        expect(programInvolves(program('ulp_tok_bze', 'ubze'), TOK, pools)).toBe(true)
        expect(programInvolves(program('ulp_usdc_tok', 'uusdc'), TOK, pools)).toBe(true)
    })

    it('is false for an unrelated program, LP of another pool included', () => {
        expect(programInvolves(program('ubze', 'uusdc'), TOK, pools)).toBe(false)
        expect(programInvolves(program('ulp_usdc_bze', 'ubze'), TOK, pools)).toBe(false)
        expect(programInvolves(program('ulp_tok_bze', 'ubze'), TOK, [])).toBe(false)
    })
})
