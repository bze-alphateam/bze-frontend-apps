import { describe, it, expect } from 'vitest'
import { noEligibleText, pickTokenElectorate, tokenDaoHref, tokenRowState, votersLine, leftOutLine } from './token-dao'

// The two params as a v8.3.0 node answers them (GET /bze/dao/params).
const PARAMS = { max_sr_per_dao: '5', min_electorate_lock_days: 5 }
const DENOM = 'factory/bze1owner/uhoney'
const LP = 'ulp_1'
const sr = (id: number, staking_denom: string, lock: number, staked_amount = '0') => ({ reward_id: String(id), staking_denom, lock, staked_amount })
const dr = (lock: number, staked_amount = '0') => ({ staking_denom: DENOM, lock, staked_amount })

describe('pickTokenElectorate', () => {
    it('has no source for a token without rewards', () => {
        const e = pickTokenElectorate({ denom: DENOM, rewards: [], params: PARAMS })
        expect(e.electorate).toEqual({ sr_ids: [], dr_denom: '' })
        expect(e.hasSources).toBe(false)
        expect(e.live).toBe(false)
        expect(e.minLock).toBe(5)
    })

    it('leaves short-lock rewards out and says why', () => {
        const e = pickTokenElectorate({ denom: DENOM, rewards: [sr(1, DENOM, 2, '100'), sr(2, DENOM, 4, '100')], denomReward: dr(3, '50'), params: PARAMS })
        expect(e.hasSources).toBe(false)
        expect(e.electorate).toEqual({ sr_ids: [], dr_denom: '' })
        expect(e.ineligible).toEqual([
            { label: 'Simple reward #1', reason: 'lock 2 days, needs 5' },
            { label: 'Simple reward #2', reason: 'lock 4 days, needs 5' },
            { label: 'Compounded reward', reason: 'lock 3 days, needs 5' },
        ])
    })

    it('never takes LP-share rewards or rewards of another denom', () => {
        const e = pickTokenElectorate({ denom: DENOM, rewards: [sr(1, LP, 30, '900'), sr(2, 'ubze', 30, '900')], params: PARAMS })
        expect(e.hasSources).toBe(false)
        expect(e.ineligible).toEqual([])
    })

    it('takes the 5 simple rewards with the most stake plus the Denom Reward', () => {
        const rewards = [1, 2, 3, 4, 5, 6, 7].map(i => sr(i, DENOM, 10, String(i * 100)))
        const e = pickTokenElectorate({ denom: DENOM, rewards, denomReward: dr(7, '1'), params: PARAMS })
        expect(e.electorate).toEqual({ sr_ids: ['7', '6', '5', '4', '3'], dr_denom: DENOM })
        expect(e.leftOut).toBe(2)
        expect(e.sources[0].kind).toBe('compounded')
        expect(e.live).toBe(true)
        expect(leftOutLine(e)).toBe('Only the 5 simple rewards with the most stake count.')
        expect(votersLine(e)).toBe('Voted by the stakers of: Compounded reward, Simple reward #7, Simple reward #6, Simple reward #5, Simple reward #4, Simple reward #3')
    })

    it('drops a Denom Reward whose lock is under the minimum', () => {
        const e = pickTokenElectorate({ denom: DENOM, rewards: [sr(1, DENOM, 5, '10')], denomReward: dr(4, '999'), params: PARAMS })
        expect(e.electorate).toEqual({ sr_ids: ['1'], dr_denom: '' })
        expect(e.ineligible).toEqual([{ label: 'Compounded reward', reason: 'lock 4 days, needs 5' }])
        expect(e.totalStaked.toString()).toBe('10')
    })

    it('is not live when every eligible source is empty', () => {
        const e = pickTokenElectorate({ denom: DENOM, rewards: [sr(1, DENOM, 7, '0')], denomReward: dr(7, '0'), params: PARAMS })
        expect(e.hasSources).toBe(true)
        expect(e.live).toBe(false)
        expect(e.electorate).toEqual({ sr_ids: ['1'], dr_denom: DENOM })
    })

    it('reads the caps from the params', () => {
        const rewards = [1, 2, 3].map(i => sr(i, DENOM, 3, String(i)))
        const e = pickTokenElectorate({ denom: DENOM, rewards, params: { max_sr_per_dao: '2', min_electorate_lock_days: 3 } })
        expect(e.electorate.sr_ids).toEqual(['3', '2'])
    })
})

describe('row state and links', () => {
    it('is green when live, amber but pickable when nobody stakes, amber and disabled without a source', () => {
        expect(tokenRowState({ hasSources: true, live: true, minLock: 5 }, '10 HONEY staked')).toEqual({ text: '10 HONEY staked', tone: 'good' })
        expect(tokenRowState({ hasSources: true, live: false, minLock: 5 }, '')).toEqual({ text: 'Nobody stakes it yet', tone: 'warn' })
        expect(tokenRowState({ hasSources: false, live: false, minLock: 5 }, '')).toEqual({ text: noEligibleText(5), tone: 'warn', disabled: true })
        expect(noEligibleText(5)).toBe('No reward with a 5+ day lock')
    })

    it('builds the /dao/new link', () => {
        expect(tokenDaoHref()).toBe('/dao/new')
        expect(tokenDaoHref(DENOM)).toBe(`/dao/new?denom=${encodeURIComponent(DENOM)}`)
        expect(tokenDaoHref(DENOM, { href: '/tokens/token?denom=x', label: 'HONEY' })).toContain('return=%2Ftokens%2Ftoken%3Fdenom%3Dx&returnLabel=HONEY')
    })
})
