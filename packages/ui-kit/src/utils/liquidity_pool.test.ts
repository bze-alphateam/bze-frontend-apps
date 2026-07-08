import { describe, it, expect } from 'vitest'
import BigNumber from 'bignumber.js'
import {
    calculateUserPoolData,
    calculatePoolOppositeAmount,
    calculatePoolPrice,
} from './liquidity_pool'
import { Balance } from '../types/balance'
import { Asset } from '../types/asset'
import { LiquidityPoolData } from '../types/liquidity_pool'
import { LiquidityPoolSDKType } from '@bze/bzejs/bze/tradebin/store'

const pool = {
    base: 'ubze',
    quote: 'uusdt',
    reserve_base: '1000',
    reserve_quote: '2000',
} as LiquidityPoolSDKType

const balance = (amount: string): Balance => ({ denom: 'ulp/ABC', amount: new BigNumber(amount) })
const lpAsset = { denom: 'ulp/ABC', supply: BigInt(1000) } as Asset
const poolData = { usdValue: new BigNumber(500) } as LiquidityPoolData

describe('calculatePoolOppositeAmount', () => {
    it('computes quote amount from base amount using reserves ratio', () => {
        expect(calculatePoolOppositeAmount(pool, '10', true).toString()).toBe('20')
    })

    it('computes base amount from quote amount', () => {
        expect(calculatePoolOppositeAmount(pool, '20', false).toString()).toBe('10')
    })

    it('returns 0 for zero or invalid amounts', () => {
        expect(calculatePoolOppositeAmount(pool, '0', true).toString()).toBe('0')
        expect(calculatePoolOppositeAmount(pool, 'garbage', true).toString()).toBe('0')
    })

    it('returns 0 when a reserve is empty', () => {
        const empty = { ...pool, reserve_base: '0' } as LiquidityPoolSDKType
        expect(calculatePoolOppositeAmount(empty, '10', true).toString()).toBe('0')
    })
})

describe('calculatePoolPrice', () => {
    it('prices the base denom in quote units', () => {
        expect(calculatePoolPrice('ubze', pool)?.toString()).toBe('2')
    })

    it('prices the quote denom in base units', () => {
        expect(calculatePoolPrice('uusdt', pool)?.toString()).toBe('0.5')
    })

    it('returns null for a denom not in the pool', () => {
        expect(calculatePoolPrice('uatom', pool)).toBeNull()
    })

    it('returns null for empty reserves or missing input', () => {
        expect(calculatePoolPrice('ubze', { ...pool, reserve_quote: '0' } as LiquidityPoolSDKType)).toBeNull()
        expect(calculatePoolPrice('', pool)).toBeNull()
    })
})

describe('calculateUserPoolData', () => {
    it('computes share percentage and USD value', () => {
        const result = calculateUserPoolData(balance('100'), lpAsset, poolData)
        expect(result.userSharesPercentage).toBe(10)
        expect(result.userLiquidityUsd.toString()).toBe('50')
    })

    it('returns zeros when the user has no balance', () => {
        const result = calculateUserPoolData(balance('0'), lpAsset, poolData)
        expect(result.userSharesPercentage).toBe(0)
        expect(result.userLiquidityUsd.isZero()).toBe(true)
    })

    it('returns zeros when balance or asset is missing', () => {
        expect(calculateUserPoolData(undefined, lpAsset, poolData).userSharesPercentage).toBe(0)
        expect(calculateUserPoolData(balance('100'), undefined, poolData).userSharesPercentage).toBe(0)
    })

    it('returns zeros when total supply is zero (no division by zero)', () => {
        const zeroSupply = { ...lpAsset, supply: BigInt(0) } as Asset
        const result = calculateUserPoolData(balance('100'), zeroSupply, poolData)
        expect(result.userSharesPercentage).toBe(0)
        expect(result.userLiquidityUsd.isZero()).toBe(true)
    })

    it('computes share percentage without USD value when pool data is missing', () => {
        const result = calculateUserPoolData(balance('100'), lpAsset, undefined)
        expect(result.userSharesPercentage).toBe(10)
        expect(result.userLiquidityUsd.isZero()).toBe(true)
    })
})
