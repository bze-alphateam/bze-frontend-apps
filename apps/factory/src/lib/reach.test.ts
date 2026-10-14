import { describe, expect, it } from 'vitest'
import BigNumber from 'bignumber.js'
import { communityOptions, reachHref, searchCommunities } from './reach'

const dr = (denom: string, staked: string) => ({ staking_denom: denom, lock: 7, min_stake: '0', staked_amount: staked })
const ASSETS: Record<string, { ticker: string; name?: string; decimals: number }> = {
    'factory/bze1me/mine': { ticker: 'MINE', name: 'My token', decimals: 6 },
    ubze: { ticker: 'BZE', name: 'BeeZee', decimals: 6 },
    uatom: { ticker: 'ATOM', name: 'Cosmos Hub', decimals: 6 },
}
const info = (denom: string) => ASSETS[denom]

describe('communityOptions', () => {
    const list = [dr('uatom', '1000000'), dr('ucold', '0'), dr('ubze', '50000000'), dr('factory/bze1me/mine', '9000000')]

    it('keeps only the holder rewards with stakers, by raw staked amount without prices', () => {
        const options = communityOptions(list, info, new Map(), 'bze1me')
        expect(options.map(o => o.ticker)).toEqual(['BZE', 'MINE', 'ATOM'])
        expect(options.map(o => o.isMine)).toEqual([false, true, false])
        expect(options[0].stakedDisplay.toString()).toBe('50')
    })

    it('sorts by staked USD value when the prices are known', () => {
        const prices = new Map([['ubze', new BigNumber('0.001')], ['uatom', new BigNumber(5)], ['factory/bze1me/mine', new BigNumber('0.01')]])
        expect(communityOptions(list, info, prices).map(o => o.ticker)).toEqual(['ATOM', 'MINE', 'BZE'])
    })

    it('marks nothing as yours without a wallet, and falls back to the denom without an asset', () => {
        const options = communityOptions([dr('factory/bze1me/mine', '1'), dr('unknown', '5')], info, new Map())
        expect(options.every(o => !o.isMine)).toBe(true)
        expect(options.map(o => o.ticker)).toContain('unknown')
    })
})

describe('searchCommunities', () => {
    const options = communityOptions([dr('uatom', '1'), dr('ubze', '2')], info, new Map())

    it('matches ticker, name or denom, case-insensitive; an empty term keeps all', () => {
        expect(searchCommunities(options, 'cosmos').map(o => o.ticker)).toEqual(['ATOM'])
        expect(searchCommunities(options, 'UBZE').map(o => o.ticker)).toEqual(['BZE'])
        expect(searchCommunities(options, '  ')).toHaveLength(2)
    })
})

describe('reachHref', () => {
    it('adds the preselected community and gift', () => {
        expect(reachHref()).toBe('/reach')
        expect(reachHref({ community: 'factory/bze1x/a', gift: 'ubze' })).toBe('/reach?community=factory%2Fbze1x%2Fa&gift=ubze')
    })
})
