import {describe, expect, it} from 'vitest'
import {
    daoSourceRows,
    summarizeDaoElectorate,
    toggleDaoSource,
    validateDaoSources,
    type DaoStakeSource,
} from './create-sources'

const PARAMS = {max_sr_per_dao: '2', min_electorate_lock_days: 5}
const tickerOf = (d: string) => d.toUpperCase()
const sr = (id: string, denom: string, lock: number, staked = '100'): DaoStakeSource => ({kind: 'sr', id, stakingDenom: denom, lock, staked})
const dr = (denom: string, lock: number, staked = '300'): DaoStakeSource => ({kind: 'dr', id: denom, stakingDenom: denom, lock, staked})
const SOURCES = [sr('1', 'honey', 14), sr('2', 'honey', 30), sr('3', 'honey', 2), sr('4', 'ubze', 21), sr('5', 'honey', 6), dr('honey', 7)]
const EMPTY = {sr_ids: [] as string[], dr_denom: ''}

describe('daoSourceRows', () => {
    it('disables a lock below the chain minimum, with the reason', () => {
        const row = daoSourceRows({sources: SOURCES, electorate: EMPTY, params: PARAMS, tickerOf}).find(r => r.id === '3')!
        expect(row.disabledReason).toContain('2-day lock: needs at least 5 days')
    })

    it('boundary: a lock of exactly the minimum is allowed', () => {
        const rows = daoSourceRows({sources: [sr('9', 'honey', 5)], electorate: EMPTY, params: PARAMS, tickerOf})
        expect(rows[0].disabledReason).toBeUndefined()
    })

    it('once a source is picked only the same staking denom stays selectable', () => {
        const rows = daoSourceRows({sources: SOURCES, electorate: {sr_ids: ['1'], dr_denom: ''}, params: PARAMS, tickerOf})
        expect(rows.find(r => r.id === '4')!.disabledReason).toContain('Stakes UBZE, not HONEY')
        expect(rows.find(r => r.id === '2')!.disabledReason).toBeUndefined()
        expect(rows.find(r => r.id === '1')!.selected).toBe(true)
    })

    it('disables further staking rewards at the cap but never a picked one', () => {
        const rows = daoSourceRows({sources: SOURCES, electorate: {sr_ids: ['1', '2'], dr_denom: ''}, params: PARAMS, tickerOf})
        expect(rows.find(r => r.id === '5')!.disabledReason).toContain('at most 2')
        expect(rows.find(r => r.id === '1')!.disabledReason).toBeUndefined()
    })

    it('lists only the host-fixed denom, Denom Reward first, then by stake', () => {
        const rows = daoSourceRows({sources: SOURCES, electorate: EMPTY, params: PARAMS, lockedDenom: 'honey', tickerOf})
        expect(rows.every(r => r.stakingDenom === 'honey')).toBe(true)
        expect(rows[0].kind).toBe('dr')
    })
})

describe('validateDaoSources', () => {
    const check = (electorate: {sr_ids: string[]; dr_denom: string}, lockedDenom?: string) =>
        validateDaoSources({sources: SOURCES, electorate, params: PARAMS, lockedDenom, tickerOf})

    it('accepts none, one source and a mix of staking rewards with the Denom Reward', () => {
        expect(check(EMPTY)).toBeUndefined()
        expect(check({sr_ids: ['1', '2'], dr_denom: 'honey'})).toBeUndefined()
    })

    it('refuses more staking rewards than the param', () => {
        expect(check({sr_ids: ['1', '2', '5'], dr_denom: ''})).toContain('at most 2')
    })

    it('refuses mixed staking denoms', () => {
        expect(check({sr_ids: ['1', '4'], dr_denom: ''})).toContain('All sources of a DAO must stake the same token')
    })

    it('refuses a source of another denom than the host fixed', () => {
        expect(check({sr_ids: ['4'], dr_denom: ''}, 'honey')).toContain('stakes UBZE, not HONEY')
    })

    it('refuses a lock below the minimum', () => {
        expect(check({sr_ids: ['3'], dr_denom: ''})).toBe('Simple reward #3 has a 2-day lock, at least 5 days are required.')
    })

    it('refuses a source that no longer exists', () => {
        expect(check({sr_ids: ['77'], dr_denom: ''})).toContain('#77 was not found')
        expect(check(EMPTY.sr_ids.length ? EMPTY : {sr_ids: [], dr_denom: 'gone'})).toContain('Compounded reward was not found')
    })
})

describe('electorate helpers', () => {
    it('toggles staking rewards and the single Denom Reward', () => {
        let e = toggleDaoSource(EMPTY, SOURCES[0], true)
        e = toggleDaoSource(e, SOURCES[5], true)
        expect(e).toEqual({sr_ids: ['1'], dr_denom: 'honey'})
        e = toggleDaoSource(e, SOURCES[0], false)
        e = toggleDaoSource(e, SOURCES[5], false)
        expect(e).toEqual(EMPTY)
    })

    it('sums the stake and is live only with something staked', () => {
        const s = summarizeDaoElectorate({sr_ids: ['1', '2'], dr_denom: 'honey'}, SOURCES)
        expect(s.staked.toString()).toBe('500')
        expect(s).toMatchObject({count: 3, live: true, stakingDenom: 'honey'})
        const dead = summarizeDaoElectorate({sr_ids: ['9'], dr_denom: ''}, [sr('9', 'honey', 7, '0')])
        expect(dead.live).toBe(false)
        expect(summarizeDaoElectorate(EMPTY, SOURCES, 'honey')).toMatchObject({count: 0, live: false, stakingDenom: 'honey'})
    })
})
