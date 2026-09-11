import { describe, it, expect } from 'vitest'
import BigNumber from 'bignumber.js'
import { LiquidityPoolSDKType } from '@bze/bzejs/bze/tradebin/store'
import {
    GAS_ESTIMATES,
    TxKind,
    canAffordTx,
    estimateGasFee,
    estimateGasUsed,
    maxSpendableAmount,
    resolveGasPrice,
} from './gas_fee'
import { calculatePoolOppositeAmount } from './liquidity_pool'

const NATIVE = 'ubze'
const USDC = 'uusdc'
const MIN_LIQUIDITY = '100000000000'

// 1M BZE : 10k USDC pool → 1 BZE ≈ 0.01 USDC, 0.3 % swap fee
const pool = {
    base: NATIVE,
    quote: USDC,
    fee: '0.003',
    reserve_base: '1000000000000',
    reserve_quote: '10000000000',
} as LiquidityPoolSDKType

// The env defaults useTx applies (constants/chain.ts).
const env = {
    gasPrice: 0.02,
    gasMultiplier: 1.5,
    nonNativeGasMultiplier: 1.5,
    foreignFeeSlippage: 1.1,
    minNativeLiquidity: MIN_LIQUIDITY,
    nativeDenom: NATIVE,
}

describe('GAS_ESTIMATES', () => {
    it('has a positive base for every kind', () => {
        (Object.keys(GAS_ESTIMATES) as TxKind[]).forEach(kind => {
            expect(GAS_ESTIMATES[kind].base).toBeGreaterThan(0)
            if (GAS_ESTIMATES[kind].perItem !== undefined) {
                expect(GAS_ESTIMATES[kind].perItem).toBeGreaterThan(0)
            }
        })
    })
})

describe('estimateGasUsed', () => {
    it('returns the base gas for a single message kind', () => {
        expect(estimateGasUsed('send').toNumber()).toBe(GAS_ESTIMATES.send.base)
        expect(estimateGasUsed({ kind: 'send' }).toNumber()).toBe(GAS_ESTIMATES.send.base)
    })

    it('adds perItem gas for every item after the first', () => {
        const { base, perItem } = GAS_ESTIMATES['fill-orders']
        expect(estimateGasUsed({ kind: 'fill-orders', count: 1 }).toNumber()).toBe(base)
        expect(estimateGasUsed({ kind: 'fill-orders', count: 4 }).toNumber()).toBe(base + perItem! * 3)
    })

    it('ignores the count for kinds without perItem and treats bad counts as one', () => {
        expect(estimateGasUsed({ kind: 'send', count: 5 }).toNumber()).toBe(GAS_ESTIMATES.send.base)
        expect(estimateGasUsed({ kind: 'fill-orders', count: 0 }).toNumber()).toBe(GAS_ESTIMATES['fill-orders'].base)
        expect(estimateGasUsed({ kind: 'fill-orders', count: -2 }).toNumber()).toBe(GAS_ESTIMATES['fill-orders'].base)
    })

    it('sums the messages of a multi-message transaction', () => {
        const expected = GAS_ESTIMATES['create-denom'].base + GAS_ESTIMATES.mint.base + GAS_ESTIMATES['set-denom-metadata'].base
        expect(estimateGasUsed(['create-denom', 'mint', 'set-denom-metadata']).toNumber()).toBe(expected)
    })

    it('skips unknown kinds instead of throwing', () => {
        expect(estimateGasUsed('nope' as TxKind).toNumber()).toBe(0)
    })
})

describe('resolveGasPrice', () => {
    it('uses the chain param when it is in the native denom and positive', () => {
        expect(resolveGasPrice({ denom: NATIVE, amount: '0.05' }, NATIVE, 0.02)).toBe(0.05)
    })

    it('falls back for a missing param, another denom, zero or garbage', () => {
        expect(resolveGasPrice(undefined, NATIVE, 0.02)).toBe(0.02)
        expect(resolveGasPrice({ denom: USDC, amount: '0.05' }, NATIVE, 0.02)).toBe(0.02)
        expect(resolveGasPrice({ denom: NATIVE, amount: '0' }, NATIVE, 0.02)).toBe(0.02)
        expect(resolveGasPrice({ denom: NATIVE, amount: 'abc' }, NATIVE, 0.02)).toBe(0.02)
    })
})

describe('estimateGasFee', () => {
    it('mirrors useTx.simulateFee for a native fee: gas × multiplier × price', () => {
        const result = estimateGasFee({ ...env, spec: 'send', txFeeDenom: NATIVE })
        const gas = GAS_ESTIMATES.send.base * 1.5
        expect(result.isNative).toBe(true)
        expect(result.denom).toBe(NATIVE)
        expect(result.gas.toNumber()).toBe(gas)
        expect(result.amount.toNumber()).toBe(Math.round(gas * 0.02))
        expect(result.nativeAmount.eq(result.amount)).toBe(true)
    })

    it('rounds the gas limit up and the native amount half-up like useTx', () => {
        // 3 gas × 1.5 = 4.5 → 5 gas; 5 × 0.3 = 1.5 → 2 ubze
        const result = estimateGasFee({ ...env, spec: 'send', txFeeDenom: NATIVE, gasMultiplier: 1.5, gasPrice: 0.3 })
        expect(result.gas.mod(1).isZero()).toBe(true)
        expect(result.amount.mod(1).isZero()).toBe(true)
    })

    it('converts through the pool with slippage and the non-native gas multiplier', () => {
        const result = estimateGasFee({ ...env, spec: 'send', txFeeDenom: USDC, pool })
        expect(result.isNative).toBe(false)
        expect(result.denom).toBe(USDC)
        expect(result.gas.toNumber()).toBe(GAS_ESTIMATES.send.base * 1.5 * 1.5)
        expect(result.nativeAmount.toNumber()).toBe(Math.round(GAS_ESTIMATES.send.base * 1.5 * 0.02))
        expect(result.amount.gt(0)).toBe(true)
        expect(result.amount.mod(1).isZero()).toBe(true)
    })

    it('is never lower than what useTx would send (spot ratio × slippage)', () => {
        const result = estimateGasFee({ ...env, spec: 'ibc-transfer', txFeeDenom: USDC, pool })
        const spot = calculatePoolOppositeAmount(pool, result.nativeAmount, pool.base === NATIVE)
        const useTxAmount = spot.multipliedBy(1.1).integerValue(BigNumber.ROUND_CEIL)
        expect(result.amount.gte(useTxAmount)).toBe(true)
    })

    it('falls back to the native fee without a pool, with a shallow pool or when the token is BZE', () => {
        expect(estimateGasFee({ ...env, spec: 'send', txFeeDenom: USDC }).isNative).toBe(true)
        expect(estimateGasFee({ ...env, spec: 'send', txFeeDenom: USDC, pool, minNativeLiquidity: pool.reserve_base }).isNative).toBe(true)
        expect(estimateGasFee({ ...env, spec: 'send', txFeeDenom: NATIVE, pool }).isNative).toBe(true)
        expect(estimateGasFee({ ...env, spec: 'send', txFeeDenom: '', pool }).isNative).toBe(true)
    })

    it('scales with the item count', () => {
        const one = estimateGasFee({ ...env, spec: { kind: 'withdraw-delegator-reward', count: 1 }, txFeeDenom: NATIVE })
        const five = estimateGasFee({ ...env, spec: { kind: 'withdraw-delegator-reward', count: 5 }, txFeeDenom: NATIVE })
        expect(five.amount.gt(one.amount)).toBe(true)
    })
})

describe('maxSpendableAmount', () => {
    const gasFee = { denom: NATIVE, amount: new BigNumber(4500) }

    it('leaves the gas fee behind when the denom is the fee denom', () => {
        expect(maxSpendableAmount('1000000', NATIVE, gasFee).toString()).toBe('995500')
    })

    it('fills the full balance for any other denom', () => {
        expect(maxSpendableAmount('1000000', USDC, gasFee).toString()).toBe('1000000')
    })

    it('fills the full balance when no gas fee is known', () => {
        expect(maxSpendableAmount('1000000', NATIVE).toString()).toBe('1000000')
    })

    it('floors at zero when the balance does not cover the gas', () => {
        expect(maxSpendableAmount('4500', NATIVE, gasFee).toString()).toBe('0')
        expect(maxSpendableAmount('100', NATIVE, gasFee).toString()).toBe('0')
    })

    it('is zero for empty, negative or NaN balances', () => {
        expect(maxSpendableAmount('0', NATIVE, gasFee).toString()).toBe('0')
        expect(maxSpendableAmount('-5', USDC, gasFee).toString()).toBe('0')
        expect(maxSpendableAmount('abc', USDC, gasFee).toString()).toBe('0')
    })
})

describe('canAffordTx', () => {
    const gasFee = { denom: NATIVE, amount: new BigNumber(4500) }
    const balances: Record<string, string> = { [NATIVE]: '1000000', [USDC]: '2000' }
    const balanceOf = (denom: string) => balances[denom] ?? '0'

    it('is affordable when every denom covers spend + gas + module fee', () => {
        const result = canAffordTx({ spend: { denom: NATIVE, amount: '900000' }, gasFee, moduleFee: { denom: NATIVE, amount: '50000' }, balanceOf })
        expect(result.canAfford).toBe(true)
        expect(result.shortfalls).toEqual([])
        expect(result.shortOnFees).toBe(false)
    })

    it('accepts spending exactly balance − gas', () => {
        expect(canAffordTx({ spend: { denom: NATIVE, amount: '995500' }, gasFee, balanceOf }).canAfford).toBe(true)
    })

    it('flags a spend that fits the balance but leaves no room for gas', () => {
        const result = canAffordTx({ spend: { denom: NATIVE, amount: '1000000' }, gasFee, balanceOf })
        expect(result.canAfford).toBe(false)
        expect(result.shortOnFees).toBe(true)
        expect(result.shortfalls[0].denom).toBe(NATIVE)
        expect(result.shortfalls[0].missing.toString()).toBe('4500')
    })

    it('does not count gas against a different denom', () => {
        expect(canAffordTx({ spend: { denom: USDC, amount: '2000' }, gasFee, balanceOf }).canAfford).toBe(true)
    })

    it('reports a plain insufficient balance (not fee-only) when the spend alone is too big', () => {
        const result = canAffordTx({ spend: { denom: USDC, amount: '5000' }, gasFee, balanceOf })
        expect(result.canAfford).toBe(false)
        expect(result.shortOnFees).toBe(false)
        expect(result.shortfalls[0]).toMatchObject({ denom: USDC })
        expect(result.shortfalls[0].missing.toString()).toBe('3000')
    })

    it('checks the gas fee alone when nothing else is spent', () => {
        expect(canAffordTx({ gasFee, balanceOf }).canAfford).toBe(true)
        expect(canAffordTx({ gasFee, balanceOf: () => '10' }).canAfford).toBe(false)
    })

    it('adds a module fee charged in the preferred token to that token', () => {
        const result = canAffordTx({
            spend: { denom: NATIVE, amount: '100' },
            gasFee: { denom: USDC, amount: '500' },
            moduleFee: { denom: USDC, amount: '1600' },
            balanceOf,
        })
        expect(result.canAfford).toBe(false)
        expect(result.shortfalls[0]).toMatchObject({ denom: USDC })
        expect(result.shortfalls[0].required.toString()).toBe('2100')
    })

    it('sums several spends of the same denom and orders shortfalls by size', () => {
        const result = canAffordTx({
            spend: [{ denom: NATIVE, amount: '600000' }, { denom: NATIVE, amount: '600000' }, { denom: USDC, amount: '2500' }],
            gasFee,
            balanceOf,
        })
        expect(result.canAfford).toBe(false)
        expect(result.shortfalls.map(s => s.denom)).toEqual([NATIVE, USDC])
    })

    it('ignores empty, zero and NaN coins', () => {
        const result = canAffordTx({ spend: [{ denom: '', amount: '5' }, { denom: NATIVE, amount: '0' }, { denom: USDC, amount: 'x' }], gasFee, balanceOf })
        expect(result.canAfford).toBe(true)
    })
})
