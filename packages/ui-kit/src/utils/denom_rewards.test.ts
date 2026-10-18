import { describe, expect, it } from 'vitest'
import BigNumber from 'bignumber.js'
import {
    claimableCoins,
    denomRewardActionBlockers,
    DenomRewardHolderItem,
    denomRewardUnlockDate,
    estimateDailyShare,
    formatUnlockCountdown,
    parsePendingUnlockIndex,
    sortDenomRewardItems,
    sumClaimableCoins,
    summarizeDailyPrizes,
    validateDenomRewardStake,
} from './denom_rewards'

const FACTORY = 'factory/bze1creator/mytoken'
const ADDR = 'bze1holder'

describe('parsePendingUnlockIndex', () => {
    it('reads a staking reward entry', () => {
        expect(parsePendingUnlockIndex(`1200/0007/${ADDR}`))
            .toEqual({ kind: 'staking-reward', epoch: 1200, rewardId: '0007', address: ADDR })
    })

    it('reads a denom reward entry with a native denom', () => {
        expect(parsePendingUnlockIndex(`1368/dr/ubze/${ADDR}`))
            .toEqual({ kind: 'denom-reward', epoch: 1368, denom: 'ubze', address: ADDR })
    })

    it('keeps the slashes of a factory denom', () => {
        expect(parsePendingUnlockIndex(`1368/dr/${FACTORY}/${ADDR}`))
            .toEqual({ kind: 'denom-reward', epoch: 1368, denom: FACTORY, address: ADDR })
    })

    it('rejects malformed indexes', () => {
        expect(parsePendingUnlockIndex('garbage')).toBeUndefined()
        expect(parsePendingUnlockIndex(`x/0007/${ADDR}`)).toBeUndefined()
        expect(parsePendingUnlockIndex(`12/dr/${ADDR}`)).toBeUndefined()
        expect(parsePendingUnlockIndex(`12/1/2/${ADDR}`)).toBeUndefined()
    })
})

const schedule = (prize: string, daily: string, duration: number, payouts: number) => ({
    schedule_id: `${prize}-${daily}`, staking_denom: FACTORY, prize_denom: prize, daily_amount: daily, duration, payouts,
})

describe('summarizeDailyPrizes', () => {
    it('sums running schedules per prize denom, biggest first, and skips finished ones', () => {
        expect(summarizeDailyPrizes([
            schedule('ubze', '100', 10, 2),
            schedule('uusdc', '5000', 10, 0),
            schedule('ubze', '50', 30, 29),
            schedule('ubze', '999', 5, 5),
        ])).toEqual([
            { denom: 'uusdc', amount: '5000' },
            { denom: 'ubze', amount: '150' },
        ])
    })

    it('is empty when nothing runs', () => {
        expect(summarizeDailyPrizes([])).toEqual([])
    })
})

describe('estimateDailyShare', () => {
    it('is stake / total × daily, rounded down', () => {
        expect(estimateDailyShare(1, 3, 100).toFixed()).toBe('33')
        expect(estimateDailyShare('250', '1000', '1000').toFixed()).toBe('250')
    })

    it('previews a deposit when given the totals after it', () => {
        // existing 300 staked, I add 100: 100 / 400 of 1000
        expect(estimateDailyShare(100, 400, 1000).toFixed()).toBe('250')
    })

    it('is zero without stake or stakers', () => {
        expect(estimateDailyShare(0, 100, 1000).toFixed()).toBe('0')
        expect(estimateDailyShare(10, 0, 1000).toFixed()).toBe('0')
    })
})

describe('validateDenomRewardStake', () => {
    const base = { minStake: '1000', balance: '5000' }

    it('accepts a first stake reaching min_stake', () => {
        expect(validateDenomRewardStake({ ...base, uAmount: new BigNumber(1000) })).toBe('')
    })

    it('refuses a first stake below min_stake', () => {
        expect(validateDenomRewardStake({ ...base, uAmount: new BigNumber(999) })).toBe('min-stake')
    })

    it('checks min_stake on the resulting position for a top-up', () => {
        expect(validateDenomRewardStake({ ...base, uAmount: new BigNumber(1), currentStake: '999' })).toBe('')
        expect(validateDenomRewardStake({ ...base, uAmount: new BigNumber(1), currentStake: '998' })).toBe('min-stake')
    })

    it('refuses more than the balance', () => {
        expect(validateDenomRewardStake({ ...base, uAmount: new BigNumber(5001) })).toBe('balance')
    })

    it('refuses empty, zero, negative and sub-unit amounts', () => {
        expect(validateDenomRewardStake({ ...base, uAmount: undefined })).toBe('invalid')
        expect(validateDenomRewardStake({ ...base, uAmount: new BigNumber(0) })).toBe('invalid')
        expect(validateDenomRewardStake({ ...base, uAmount: new BigNumber(-5) })).toBe('invalid')
        expect(validateDenomRewardStake({ ...base, uAmount: new BigNumber(1000.5) })).toBe('invalid')
        expect(validateDenomRewardStake({ ...base, uAmount: new BigNumber(NaN) })).toBe('invalid')
    })
})

const dr = (denom: string, staked: string) => ({ staking_denom: denom, lock: 7, min_stake: '0', staked_amount: staked })
const position = (denom: string, pending: { denom: string; amount: string }[] = []) => ({
    participant: { address: ADDR, staking_denom: denom, amount: '10' }, pending,
})

describe('claimableCoins / sumClaimableCoins', () => {
    it('drops zero amounts', () => {
        expect(claimableCoins(position(FACTORY, [{ denom: 'ubze', amount: '0' }, { denom: 'uusdc', amount: '7' }])))
            .toEqual([{ denom: 'uusdc', amount: '7' }])
        expect(claimableCoins(undefined)).toEqual([])
    })

    it('sums several DRs per prize denom', () => {
        const items: DenomRewardHolderItem[] = [
            { denomReward: dr('a', '1'), position: position('a', [{ denom: 'ubze', amount: '5' }]), unlocks: [] },
            { denomReward: dr('b', '1'), position: position('b', [{ denom: 'ubze', amount: '7' }, { denom: 'uusdc', amount: '1' }]), unlocks: [] },
            { denomReward: dr('c', '1'), unlocks: [] },
        ]
        expect(sumClaimableCoins(items)).toEqual([{ denom: 'ubze', amount: '12' }, { denom: 'uusdc', amount: '1' }])
    })
})

describe('denomRewardUnlockDate', () => {
    it('is undefined for lock 0 (paid back in the exit tx)', () => {
        expect(denomRewardUnlockDate(0)).toBeUndefined()
    })

    it('is now + lock days', () => {
        const now = new Date('2026-10-08T12:00:00Z')
        expect(denomRewardUnlockDate(7, now)?.toISOString()).toBe('2026-10-15T12:00:00.000Z')
    })
})

describe('formatUnlockCountdown', () => {
    it('counts hours, then days', () => {
        expect(formatUnlockCountdown(100, 100)).toBe('within the hour')
        expect(formatUnlockCountdown(101, 100)).toBe('within the hour')
        expect(formatUnlockCountdown(105, 100)).toBe('in 5 hours')
        expect(formatUnlockCountdown(100 + 24 * 7, 100)).toBe('in 7 days')
    })
})

describe('sortDenomRewardItems', () => {
    it('puts my positions first, then unlocks, then paying DRs, then the rest — ties by total staked', () => {
        const pays = [{ denom: 'ubze', amount: '1' }]
        const items: DenomRewardHolderItem[] = [
            { denomReward: dr('idle-big', '900'), dailyPrizes: [], unlocks: [] },
            { denomReward: dr('paying-small', '10'), dailyPrizes: pays, unlocks: [] },
            { denomReward: dr('unknown', '5'), dailyPrizes: undefined, unlocks: [] },
            { denomReward: dr('paying-big', '500'), dailyPrizes: pays, unlocks: [] },
            { denomReward: dr('unlocking', '1'), dailyPrizes: [], unlocks: [{ staking_denom: 'unlocking', amount: '3', unlockEpoch: 9 }] },
            // a position with no running schedule still comes first (it keeps earning airdrops)
            { denomReward: dr('mine-idle', '2'), dailyPrizes: [], position: position('mine-idle'), unlocks: [] },
        ]
        expect(sortDenomRewardItems(items).map(i => i.denomReward.staking_denom)).toEqual([
            'mine-idle', 'unlocking', 'paying-big', 'paying-small', 'idle-big', 'unknown',
        ])
    })
})

describe('denomRewardActionBlockers', () => {
    // min stake 10 TOK (6 decimals)
    const dr = { staking_denom: FACTORY, lock: 7, min_stake: '10000000', staked_amount: '1000000000' }
    const position = (pending: string) => ({
        participant: { address: ADDR, staking_denom: FACTORY, amount: '20000000' },
        pending: [{ denom: 'ubze', amount: pending }],
    })
    const item = (extra: Partial<DenomRewardHolderItem> = {}): DenomRewardHolderItem =>
        ({ denomReward: dr, dailyPrizes: [], unlocks: [], ...extra })

    it('asks for a wallet first', () => {
        const b = denomRewardActionBlockers({ item: item(), hasWallet: false, balance: 0 })
        expect(b.stake).toMatch(/Connect your wallet/)
        expect(b.claim).toMatch(/Connect your wallet/)
        expect(b.exit).toMatch(/Connect your wallet/)
    })

    it('blocks a first stake below the minimum and without any balance', () => {
        const below = denomRewardActionBlockers({ item: item(), hasWallet: true, balance: new BigNumber(9_999_999) })
        expect(below.stake).toMatch(/below the minimum stake/)
        expect(below.claim).toMatch(/no stake/)
        expect(below.exit).toMatch(/no stake/)
        expect(denomRewardActionBlockers({ item: item(), hasWallet: true, balance: '0' }).stake).toMatch(/hold none/)
    })

    it('lets a position add any amount, and claims only when something is pending', () => {
        expect(denomRewardActionBlockers({ item: item({ position: position('1500000') }), hasWallet: true, balance: 1 }))
            .toEqual({ stake: '', claim: '', exit: '' })

        const nothing = denomRewardActionBlockers({ item: item({ position: position('0') }), hasWallet: true, balance: 1 })
        expect(nothing.claim).toMatch(/Nothing to claim yet/)
        expect(nothing.exit).toBe('')
    })
})
