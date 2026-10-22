import { describe, expect, it } from 'vitest'
import { giftNeedsStakable, reachCommunitySummary, reachDoneText, reachDoneTitle, reachHref, reachSentence } from './reach'

describe('reachCommunitySummary', () => {
    it('names the stakers and what they stake', () => {
        expect(reachCommunitySummary('PAGE', '4,100,000')).toBe('PAGE stakers · 4,100,000 staked')
    })
})

describe('reachSentence', () => {
    it('once: split right now, by stake', () => {
        expect(reachSentence('once', { amount: '200 HONEY', community: 'PAGE' }))
            .toBe('200 HONEY is split right now between everyone staking PAGE, by how much each stakes.')
    })

    it('daily: a day for N days, with the total once known', () => {
        expect(reachSentence('daily', { amount: '2 HONEY', community: 'PAGE', days: 10, total: '20 HONEY' }))
            .toBe('2 HONEY a day for 10 days (20 HONEY in all), shared by everyone staking PAGE that day. Days with nobody staking are skipped.')
        expect(reachSentence('daily', { amount: '2 HONEY', community: 'PAGE' }))
            .toBe('2 HONEY a day for N days, shared by everyone staking PAGE that day. Days with nobody staking are skipped.')
    })
})

describe('giftNeedsStakable', () => {
    const MINE = 'factory/bze1me/honey'

    it('only your own factory token, once the stakable list is known, when nothing stakes it', () => {
        expect(giftNeedsStakable(MINE, 'bze1me', [])).toBe(true)
        expect(giftNeedsStakable(MINE, 'bze1me', [MINE])).toBe(false)
        expect(giftNeedsStakable(MINE, 'bze1me', undefined)).toBe(false)
        expect(giftNeedsStakable(MINE, undefined, [])).toBe(false)
        expect(giftNeedsStakable('ubze', 'bze1me', [])).toBe(false)
        expect(giftNeedsStakable('factory/bze1other/page', 'bze1me', [])).toBe(false)
    })
})

describe('the Done screen', () => {
    const base = { communityDenom: 'upage', communityTicker: 'PAGE', giftDenom: 'uhoney', giftTicker: 'HONEY', amount: '200 HONEY' }

    it('the title stresses the gift', () => {
        expect(reachDoneTitle(base)).toBe('**HONEY** is on its way to PAGE stakers.')
    })

    it('the text of each mode', () => {
        expect(reachDoneText({ ...base, mode: 'once' })).toBe('200 HONEY was split between everyone staking PAGE. They can claim it right away.')
        expect(reachDoneText({ ...base, mode: 'daily', days: 30 }))
            .toBe("200 HONEY a day for 30 days, shared by everyone staking PAGE. Your token shows up as a prize on PAGE's Communities page.")
    })
})

describe('reachHref', () => {
    it('adds the preselected community and gift', () => {
        expect(reachHref()).toBe('/reach')
        expect(reachHref({ community: 'factory/bze1x/a', gift: 'ubze' })).toBe('/reach?community=factory%2Fbze1x%2Fa&gift=ubze')
    })
})
