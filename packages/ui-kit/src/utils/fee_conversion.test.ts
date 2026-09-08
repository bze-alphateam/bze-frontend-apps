import { describe, it, expect } from 'vitest'
import BigNumber from 'bignumber.js'
import { LiquidityPoolSDKType } from '@bze/bzejs/bze/tradebin/store'
import {
    calculateOptimalInputForOutput,
    estimateFeeInPreferredDenom,
    resolveFeePayment,
    FeeEstimate,
} from './fee_conversion'

const NATIVE = 'ubze'
const USDC = 'uusdc'
const MIN_LIQUIDITY = '100000000000' // 100k BZE, the chain default

// 1M BZE : 10k USDC pool → 1 BZE ≈ 0.01 USDC, 0.3 % swap fee
const pool = {
    base: NATIVE,
    quote: USDC,
    fee: '0.003',
    reserve_base: '1000000000000',
    reserve_quote: '10000000000',
} as LiquidityPoolSDKType

const takerFee = { denom: NATIVE, amount: '100000' } // 0.1 BZE

describe('calculateOptimalInputForOutput', () => {
    it('mirrors the chain constant-product formula with the swap fee and rounds up', () => {
        // real_input = 100000 * 10000000000 / (1000000000000 - 100000) = 1000.0001000…
        // input = real_input / 0.997 = 1003.0091… → ceil → 1004
        const input = calculateOptimalInputForOutput(pool, NATIVE, takerFee.amount)
        expect(input?.toString()).toBe('1004')
    })

    it('works in the other direction (output is the quote denom)', () => {
        // real_input = 1000 * 1000000000000 / (10000000000 - 1000) = 100000.01…
        // / 0.997 → 100300.91… → 100301
        expect(calculateOptimalInputForOutput(pool, USDC, '1000')?.toString()).toBe('100301')
    })

    it('ignores the fee when the pool has none', () => {
        const noFee = { ...pool, fee: '0' } as LiquidityPoolSDKType
        // real_input = 1000.0001 → ceil → 1001
        expect(calculateOptimalInputForOutput(noFee, NATIVE, takerFee.amount)?.toString()).toBe('1001')
    })

    it('never returns less than one micro-unit for a positive output', () => {
        // 1 ubze out of a deep pool needs a fraction of a uusdc → rounded up to 1
        expect(calculateOptimalInputForOutput(pool, NATIVE, '1')?.toString()).toBe('1')
    })

    it('returns undefined for non-positive or NaN output', () => {
        expect(calculateOptimalInputForOutput(pool, NATIVE, '0')).toBeUndefined()
        expect(calculateOptimalInputForOutput(pool, NATIVE, '-5')).toBeUndefined()
        expect(calculateOptimalInputForOutput(pool, NATIVE, 'abc')).toBeUndefined()
    })

    it('returns undefined for a denom that is not in the pool', () => {
        expect(calculateOptimalInputForOutput(pool, 'uatom', '10')).toBeUndefined()
    })

    it('returns undefined when the output reaches or exceeds the reserve', () => {
        expect(calculateOptimalInputForOutput(pool, NATIVE, pool.reserve_base)).toBeUndefined()
        expect(calculateOptimalInputForOutput(pool, NATIVE, '2000000000000')).toBeUndefined()
    })

    it('returns undefined for empty reserves or a 100 % fee', () => {
        const empty = { ...pool, reserve_quote: '0' } as LiquidityPoolSDKType
        expect(calculateOptimalInputForOutput(empty, NATIVE, '10')).toBeUndefined()
        const fullFee = { ...pool, fee: '1' } as LiquidityPoolSDKType
        expect(calculateOptimalInputForOutput(fullFee, NATIVE, '10')).toBeUndefined()
    })
})

describe('estimateFeeInPreferredDenom', () => {
    const estimate = (overrides: Partial<Parameters<typeof estimateFeeInPreferredDenom>[0]> = {}) =>
        estimateFeeInPreferredDenom({
            fee: takerFee,
            nativeDenom: NATIVE,
            preferredDenom: USDC,
            pool,
            minNativeLiquidity: MIN_LIQUIDITY,
            ...overrides,
        })

    it('estimates the preferred-denom amount when the pool is eligible', () => {
        const result = estimate()
        expect(result.reason).toBe('estimated')
        expect(result.nativeDenom).toBe(NATIVE)
        expect(result.nativeAmount.toString()).toBe('100000')
        expect(result.preferredDenom).toBe(USDC)
        expect(result.preferredAmount?.toString()).toBe('1004')
    })

    it('accepts a pool listed with the denoms swapped', () => {
        const flipped = {
            ...pool,
            base: USDC,
            quote: NATIVE,
            reserve_base: pool.reserve_quote,
            reserve_quote: pool.reserve_base,
        } as LiquidityPoolSDKType
        const result = estimate({ pool: flipped })
        expect(result.reason).toBe('estimated')
        expect(result.preferredAmount?.toString()).toBe('1004')
    })

    it('is native when the preferred denom is the native coin', () => {
        const result = estimate({ preferredDenom: NATIVE })
        expect(result.reason).toBe('native')
        expect(result.preferredAmount).toBeUndefined()
        expect(result.nativeAmount.toString()).toBe('100000')
    })

    it('is native when no preferred denom is set', () => {
        expect(estimate({ preferredDenom: '' }).reason).toBe('native')
    })

    it('is native when the fee itself is not in the native coin (charged as-is)', () => {
        const result = estimate({ fee: { denom: USDC, amount: '5' } })
        expect(result.reason).toBe('native')
        expect(result.nativeDenom).toBe(USDC)
        expect(result.nativeAmount.toString()).toBe('5')
    })

    it('reports no-pool when the pool is missing or for other denoms', () => {
        expect(estimate({ pool: undefined }).reason).toBe('no-pool')
        const other = { ...pool, quote: 'uatom' } as LiquidityPoolSDKType
        expect(estimate({ pool: other }).reason).toBe('no-pool')
    })

    it('reports low-liquidity when the native reserve is at or below the minimum', () => {
        expect(estimate({ minNativeLiquidity: pool.reserve_base }).reason).toBe('low-liquidity')
        expect(estimate({ minNativeLiquidity: '9999999999999' }).reason).toBe('low-liquidity')
        const drained = { ...pool, reserve_base: '0' } as LiquidityPoolSDKType
        expect(estimate({ pool: drained }).reason).toBe('low-liquidity')
    })

    it('reports pool-too-small when the pool cannot output the fee', () => {
        const tiny = { ...pool, reserve_base: '200000000000', reserve_quote: '10' } as LiquidityPoolSDKType
        const result = estimate({ pool: tiny, fee: { denom: NATIVE, amount: '200000000000' } })
        expect(result.reason).toBe('pool-too-small')
        expect(result.preferredAmount).toBeUndefined()
    })

    it('treats a malformed fee amount as zero instead of NaN', () => {
        const result = estimate({ fee: { denom: NATIVE, amount: 'oops' }, preferredDenom: NATIVE })
        expect(result.nativeAmount.toString()).toBe('0')
    })
})

describe('resolveFeePayment', () => {
    const estimated: FeeEstimate = {
        reason: 'estimated',
        nativeDenom: NATIVE,
        nativeAmount: new BigNumber('100000'),
        preferredDenom: USDC,
        preferredAmount: new BigNumber('1004'),
    }
    const nativeOnly: FeeEstimate = { ...estimated, reason: 'no-pool', preferredAmount: undefined }

    it('pays with the preferred token when its balance covers the estimate', () => {
        expect(resolveFeePayment(estimated, '1004', '0')).toBe('preferred')
        expect(resolveFeePayment(estimated, '5000', '0')).toBe('preferred')
    })

    it('falls back to native when the preferred balance is short but native covers it', () => {
        expect(resolveFeePayment(estimated, '1003', '100000')).toBe('fallback')
    })

    it('is insufficient when neither balance covers the fee', () => {
        expect(resolveFeePayment(estimated, '1003', '99999')).toBe('insufficient')
    })

    it('uses the native balance only when the preferred token is not usable', () => {
        expect(resolveFeePayment(nativeOnly, '999999', '100000')).toBe('native')
        expect(resolveFeePayment(nativeOnly, '999999', '99999')).toBe('insufficient')
    })

    it('accepts BigNumber balances', () => {
        expect(resolveFeePayment(estimated, new BigNumber(2000), new BigNumber(0))).toBe('preferred')
    })
})
