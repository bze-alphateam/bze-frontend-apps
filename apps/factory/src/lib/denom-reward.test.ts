import { describe, expect, it } from 'vitest'
import {
    MAX_SCHEDULE_DAYS,
    airdropBlocker,
    airdropFormHref,
    denomRewardHref,
    formatLastPaid,
    summarizeAirdropCosts,
    prizeSlot,
    scheduleDaysLeft,
    scheduleFormHref,
    scheduleRemainingBudget,
    summarizeScheduleCosts,
    validateScheduleDays,
} from './denom-reward'

const BZE_FEE = { denom: 'ubze', amount: '25000000000' }

describe('validateScheduleDays — create', () => {
    it.each(['1', '30', String(MAX_SCHEDULE_DAYS)])('accepts %s days', (days) => {
        expect(validateScheduleDays(days)).toBe('')
    })

    it('rejects 0 and anything above 36,500 before signing', () => {
        expect(validateScheduleDays('0')).toMatch(/between 1 and 36,500/)
        expect(validateScheduleDays('36501')).toMatch(/between 1 and 36,500/)
    })

    it('rejects empty, fractional and negative input', () => {
        expect(validateScheduleDays('')).toBe('Required.')
        expect(validateScheduleDays('1.5')).toMatch(/whole number/)
        expect(validateScheduleDays('-3')).toMatch(/whole number/)
    })
})

describe('validateScheduleDays — extend (extra days on top of the current duration)', () => {
    it('accepts extra days that keep the total within 36,500', () => {
        expect(validateScheduleDays('500', 36000)).toBe('')
    })

    it('rejects 0 extra days and a total past 36,500', () => {
        expect(validateScheduleDays('0', 30)).toMatch(/between 1 and 36,470/)
        expect(validateScheduleDays('501', 36000)).toMatch(/between 1 and 500/)
    })

    it('explains when the schedule is already at the maximum', () => {
        expect(validateScheduleDays('1', MAX_SCHEDULE_DAYS)).toMatch(/already runs the maximum/)
    })
})

describe('schedule budget', () => {
    const schedule = { daily_amount: '1000000', duration: 30, payouts: 4 }

    it('remaining budget = daily × (duration − payouts)', () => {
        expect(scheduleDaysLeft(schedule)).toBe(26)
        expect(scheduleRemainingBudget(schedule).toFixed()).toBe('26000000')
    })

    it('never goes negative', () => {
        expect(scheduleDaysLeft({ duration: 3, payouts: 5 })).toBe(0)
        expect(scheduleRemainingBudget({ daily_amount: '7', duration: 3, payouts: 5 }).toFixed()).toBe('0')
    })
})

describe('prizeSlot', () => {
    const prizes = [{ prize_denom: 'ubze' }, { prize_denom: 'factory/bze1x/a' }]

    it('a prize denom the DR already pays is free and needs no slot', () => {
        expect(prizeSlot(prizes, 'ubze', 2)).toEqual({ isNewPrize: false, capReached: false, used: 2 })
    })

    it('a new prize denom takes a slot and hits the cap when the DR is full', () => {
        expect(prizeSlot(prizes, 'uatom', 3)).toEqual({ isNewPrize: true, capReached: false, used: 2 })
        expect(prizeSlot(prizes, 'uatom', 2)).toEqual({ isNewPrize: true, capReached: true, used: 2 })
    })

    it('never warns about the cap when it is unknown', () => {
        expect(prizeSlot(prizes, 'uatom').capReached).toBe(false)
    })
})

describe('summarizeScheduleCosts', () => {
    it('escrows daily × days of the prize and charges the schedule fee for a known prize', () => {
        const summary = summarizeScheduleCosts({
            dailyUAmount: '1000000', days: 30, prizeDenom: 'ufoo', mode: 'create',
            scheduleFee: BZE_FEE, prizeFee: BZE_FEE, isNewPrize: false,
        })

        expect(summary.escrow).toEqual({ denom: 'ufoo', amount: '30000000' })
        expect(summary.fees).toEqual([{ label: 'Schedule fee', coin: BZE_FEE }])
        expect(summary.feeTotals).toEqual([BZE_FEE])
        expect(summary.feesKnown).toBe(true)
    })

    it('adds the prize-token fee for a prize new to the DR and sums same-denom fees', () => {
        const summary = summarizeScheduleCosts({
            dailyUAmount: '1000000', days: 30, prizeDenom: 'ufoo', mode: 'create',
            scheduleFee: BZE_FEE, prizeFee: BZE_FEE, isNewPrize: true,
        })

        expect(summary.fees.map(f => f.label)).toEqual(['Schedule fee', 'New prize token fee'])
        expect(summary.feeTotals).toEqual([{ denom: 'ubze', amount: '50000000000' }])
    })

    it('keeps fees of different denoms apart', () => {
        const summary = summarizeScheduleCosts({
            dailyUAmount: '1', days: 1, prizeDenom: 'ufoo', mode: 'create',
            scheduleFee: BZE_FEE, prizeFee: { denom: 'uatom', amount: '5' }, isNewPrize: true,
        })

        expect(summary.feeTotals).toEqual([BZE_FEE, { denom: 'uatom', amount: '5' }])
    })

    it('extending charges no fee, only the extra escrow', () => {
        const summary = summarizeScheduleCosts({
            dailyUAmount: '250', days: 10, prizeDenom: 'ubze', mode: 'extend',
            scheduleFee: BZE_FEE, prizeFee: BZE_FEE, isNewPrize: false,
        })

        expect(summary.escrow).toEqual({ denom: 'ubze', amount: '2500' })
        expect(summary.fees).toEqual([])
        expect(summary.feeTotals).toEqual([])
        expect(summary.feesKnown).toBe(true)
    })

    it('flags an unknown fee instead of treating it as free', () => {
        const summary = summarizeScheduleCosts({
            dailyUAmount: '1', days: 1, prizeDenom: 'ufoo', mode: 'create', isNewPrize: true,
        })

        expect(summary.feesKnown).toBe(false)
    })

    it('a zero fee param is named but not charged', () => {
        const summary = summarizeScheduleCosts({
            dailyUAmount: '1', days: 1, prizeDenom: 'ufoo', mode: 'create',
            scheduleFee: { denom: 'ubze', amount: '0' }, isNewPrize: false,
        })

        expect(summary.fees).toHaveLength(1)
        expect(summary.feeTotals).toEqual([])
    })

    it('has no escrow while the inputs are invalid', () => {
        expect(summarizeScheduleCosts({ prizeDenom: 'ufoo', mode: 'create', days: 30 }).escrow).toBeUndefined()
        expect(summarizeScheduleCosts({ dailyUAmount: '5', prizeDenom: 'ufoo', mode: 'create' }).escrow).toBeUndefined()
    })
})

describe('scheduleFormHref', () => {
    it('encodes factory denoms (with slashes) as the query param', () => {
        expect(scheduleFormHref('factory/bze1x/tok')).toBe('/denom-reward/schedule?denom=factory%2Fbze1x%2Ftok')
        expect(scheduleFormHref('factory/bze1x/tok', '000007')).toBe('/denom-reward/schedule?denom=factory%2Fbze1x%2Ftok&schedule=000007')
    })
})

describe('links', () => {
    it('deep-link the airdrop form and the public denom reward page with an encoded denom', () => {
        expect(airdropFormHref('factory/bze1x/utok')).toBe('/denom-reward/airdrop?denom=factory%2Fbze1x%2Futok')
        expect(denomRewardHref('ibc/ABC')).toBe('/denom-reward/token?denom=ibc%2FABC')
    })
})

describe('summarizeAirdropCosts', () => {
    it('takes the amount and, for a prize token new to the DR, the prize fee', () => {
        const costs = summarizeAirdropCosts({ uAmount: '5000000', prizeDenom: 'uatom', prizeFee: BZE_FEE, isNewPrize: true })
        expect(costs.escrow).toEqual({ denom: 'uatom', amount: '5000000' })
        expect(costs.fees).toEqual([{ label: 'New prize token fee', coin: BZE_FEE }])
        expect(costs.feeTotals).toEqual([BZE_FEE])
        expect(costs.feesKnown).toBe(true)
    })

    it('charges no fee for a prize token the DR already pays', () => {
        const costs = summarizeAirdropCosts({ uAmount: '5000000', prizeDenom: 'ubze', prizeFee: BZE_FEE, isNewPrize: false })
        expect(costs.fees).toEqual([])
        expect(costs.feeTotals).toEqual([])
        expect(costs.feesKnown).toBe(true)
    })

    it('never treats an unreadable prize fee as free', () => {
        expect(summarizeAirdropCosts({ uAmount: '1', prizeDenom: 'uatom', isNewPrize: true }).feesKnown).toBe(false)
    })

    it('has no amount while the input is invalid or zero', () => {
        expect(summarizeAirdropCosts({ prizeDenom: 'uatom' }).escrow).toBeUndefined()
        expect(summarizeAirdropCosts({ uAmount: '0', prizeDenom: 'uatom' }).escrow).toBeUndefined()
        expect(summarizeAirdropCosts({ uAmount: '5', prizeDenom: '' }).escrow).toBeUndefined()
    })
})

describe('airdropBlocker', () => {
    const freeSlot = { isNewPrize: false, capReached: false, used: 1 }

    it('refuses a DR without stakers, whatever the prize', () => {
        expect(airdropBlocker({ stakedAmount: '0', prizeDenom: '', slot: freeSlot, feesKnown: true })).toMatch(/no one to pay/)
        expect(airdropBlocker({ stakedAmount: '', prizeDenom: 'ubze', slot: freeSlot, feesKnown: true })).toMatch(/no one to pay/)
    })

    it('refuses a new prize token once the cap is reached', () => {
        const slot = { isNewPrize: true, capReached: true, used: 2 }
        expect(airdropBlocker({ stakedAmount: '10', prizeDenom: 'uatom', slot, feesKnown: true })).toMatch(/maximum number of prize tokens/)
    })

    it('refuses a new prize token whose fee is unknown', () => {
        const slot = { isNewPrize: true, capReached: false, used: 1 }
        expect(airdropBlocker({ stakedAmount: '10', prizeDenom: 'uatom', slot, feesKnown: false })).toMatch(/couldn't be read/)
    })

    it('lets a staked DR through', () => {
        expect(airdropBlocker({ stakedAmount: '10', prizeDenom: 'ubze', slot: freeSlot, feesKnown: true })).toBe('')
        expect(airdropBlocker({ stakedAmount: '10', prizeDenom: '', slot: freeSlot, feesKnown: true })).toBe('')
    })
})

describe('formatLastPaid', () => {
    it('reads epoch 0 as never paid', () => {
        expect(formatLastPaid('0', '120')).toBe('Never')
        expect(formatLastPaid(0)).toBe('Never')
    })

    it('counts days back from the current day epoch', () => {
        expect(formatLastPaid('120', '120')).toBe('Today')
        expect(formatLastPaid('119', 120)).toBe('Yesterday')
        expect(formatLastPaid('100', '1100')).toBe('1,000 days ago')
    })

    it('falls back to the raw day when the current epoch is unknown', () => {
        expect(formatLastPaid('42')).toBe('Day 42')
        expect(formatLastPaid('42', '')).toBe('Day 42')
    })
})
