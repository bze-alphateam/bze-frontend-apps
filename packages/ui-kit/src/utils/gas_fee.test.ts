import { describe, it, expect } from 'vitest'
import BigNumber from 'bignumber.js'
import { LiquidityPoolSDKType } from '@bze/bzejs/bze/tradebin/store'
import {
    FEE_SWAP_GAS,
    GAS_ESTIMATES,
    TxKind,
    canAffordTx,
    computeForeignGasFee,
    computeNativeGasFee,
    estimateGasFee,
    estimateGasUsed,
    maxSpendableAmount,
    resolveGasPrice,
} from './gas_fee'

const NATIVE = 'ubze'
const USDC = 'uusdc'
const MIN_LIQUIDITY = '100000000000'

// What the ante handler requires for a gas limit paid in the native denom: ceil(gas × minGasPrice).
const chainNativeRequirement = (gas: BigNumber, gasPrice: number) =>
    gas.multipliedBy(gasPrice).integerValue(BigNumber.ROUND_CEIL)

// What the ante handler requires for a gas limit paid in the pool's other token:
// ceil(gas × minGasPrice / spot), spot = nativeReserve / foreignReserve.
const chainForeignRequirement = (gas: BigNumber, gasPrice: number, p: LiquidityPoolSDKType) => {
    const spot = new BigNumber(p.reserve_base).dividedBy(p.reserve_quote)
    return gas.multipliedBy(gasPrice).dividedBy(spot).integerValue(BigNumber.ROUND_CEIL)
}

// 1M BZE : 10k USDC pool → 1 BZE ≈ 0.01 USDC, 0.3 % swap fee
const pool = {
    base: NATIVE,
    quote: USDC,
    fee: '0.003',
    reserve_base: '1000000000000',
    reserve_quote: '10000000000',
} as LiquidityPoolSDKType

// The chain's validator_min_gas_fee (0.01 ubze/gas on mainnet) with the env defaults useTx
// applies for the gas margin and the foreign fee slippage (constants/chain.ts).
const CHAIN_GAS_PRICE = 0.01
const env = {
    gasPrice: CHAIN_GAS_PRICE,
    gasMultiplier: 1.2,
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

    it('estimates a governance vote', () => {
        expect(estimateGasUsed('vote').toNumber()).toBe(120_000)
    })

    it('adds perItem gas for every item after the first', () => {
        const { base, perItem } = GAS_ESTIMATES['fill-orders']
        expect(estimateGasUsed({ kind: 'fill-orders', count: 1 }).toNumber()).toBe(base)
        expect(estimateGasUsed({ kind: 'fill-orders', count: 4 }).toNumber()).toBe(base + perItem! * 3)
    })

    it('a multi-send adds perItem gas for every output after the first', () => {
        expect(estimateGasUsed({ kind: 'multi-send', count: 3 }).toNumber()).toBe(200_000 + 2 * 35_000)
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

    // The measured table was paid in ubze, so its module fees were captured without a swap; in
    // another token every captured module fee is swapped in the tx, which the simulation measures.
    it('adds the fee swap gas per captured module fee when the fee is paid in another token', () => {
        expect(estimateGasUsed('create-order', { foreignFee: true }).toNumber()).toBe(GAS_ESTIMATES['create-order'].base + FEE_SWAP_GAS)
        expect(estimateGasUsed('create-denom-reward-schedule', { foreignFee: true }).toNumber())
            .toBe(GAS_ESTIMATES['create-denom-reward-schedule'].base + 2 * FEE_SWAP_GAS)
        expect(estimateGasUsed({ kind: 'fill-orders', count: 3 }, { foreignFee: true }).toNumber())
            .toBe(GAS_ESTIMATES['fill-orders'].base + 2 * GAS_ESTIMATES['fill-orders'].perItem! + FEE_SWAP_GAS)
    })

    it('adds no fee swap gas in the native denom or for kinds without a module fee', () => {
        expect(estimateGasUsed('create-order').toNumber()).toBe(GAS_ESTIMATES['create-order'].base)
        expect(estimateGasUsed('create-order', { foreignFee: false }).toNumber()).toBe(GAS_ESTIMATES['create-order'].base)
        expect(estimateGasUsed('send', { foreignFee: true }).toNumber()).toBe(GAS_ESTIMATES.send.base)
    })

    it('marks every kind whose message captures a module fee', () => {
        const swapping = (Object.keys(GAS_ESTIMATES) as TxKind[]).filter(kind => GAS_ESTIMATES[kind].feeSwaps).sort()
        expect(swapping).toEqual([
            'create-denom', 'create-denom-reward', 'create-denom-reward-schedule', 'create-market', 'create-order',
            'create-pool', 'create-staking-reward', 'create-trading-reward', 'distribute-denom-rewards', 'fill-orders', 'swap',
        ])
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

describe('computeNativeGasFee', () => {
    it('rounds the gas limit up, then the fee up: fee = ceil(gas × price)', () => {
        // 3 gas × 1.5 = 4.5 → 5 gas; 5 × 0.3 = 1.5 → 2 ubze
        const fee = computeNativeGasFee(3, 0.3, 1.5)
        expect(fee.gas.toNumber()).toBe(5)
        expect(fee.amount.toNumber()).toBe(2)
    })

    // Regression: the fee was rounded half-up, one ubze short of the chain's ceil whenever
    // gas × price ended in .01–.49 — at the real 0.01 price, every gas limit ending in 01..49.
    it('never sends a fee below ceil(gas × 0.01): simulated 123410 gas → 185115 gas → 1852 ubze', () => {
        const fee = computeNativeGasFee(123_410, CHAIN_GAS_PRICE, 1.5)
        expect(fee.gas.toNumber()).toBe(185_115)
        expect(fee.amount.toNumber()).toBe(1852)
        expect(fee.amount.gte(chainNativeRequirement(fee.gas, CHAIN_GAS_PRICE))).toBe(true)
    })

    it('satisfies the chain rule for every gas limit remainder', () => {
        for (let gasUsed = 100_000; gasUsed < 100_100; gasUsed++) {
            const fee = computeNativeGasFee(gasUsed, CHAIN_GAS_PRICE, 1.5)
            expect(fee.gas.mod(1).isZero()).toBe(true)
            expect(fee.amount.gte(chainNativeRequirement(fee.gas, CHAIN_GAS_PRICE))).toBe(true)
        }
    })

    it('rounds a fractional gas limit up before pricing it', () => {
        // 123411 × 1.5 = 185116.5 → 185117 gas → 1851.17 → 1852 ubze
        const fee = computeNativeGasFee(123_411, CHAIN_GAS_PRICE, 1.5)
        expect(fee.gas.toNumber()).toBe(185_117)
        expect(fee.amount.toNumber()).toBe(1852)
    })
})

describe('computeForeignGasFee', () => {
    // ceil(123410 × 1.2)
    const nativeGas = new BigNumber(148_092)

    // The gas limit is the native one: the simulation already ran with the fee in this token, so a
    // second margin (the old non-native ×1.5) only overcharged.
    it('keeps the native gas limit and prices it at the spot ratio, with the slippage buffer', () => {
        const fee = computeForeignGasFee(nativeGas, CHAIN_GAS_PRICE, 1.1, pool, NATIVE)!
        expect(fee.gas.toNumber()).toBe(148_092)
        expect(fee.nativeAmount.toNumber()).toBe(1481)           // ceil(148092 × 0.01)
        // 1481 ubze at 0.01 USDC/BZE = 14.81 uusdc × 1.1 = 16.291 → 17
        expect(fee.amount.toNumber()).toBe(17)
    })

    it('is the native fee for that gas limit at spot, times the slippage buffer', () => {
        const native = computeNativeGasFee(123_410, CHAIN_GAS_PRICE, 1.2)
        const fee = computeForeignGasFee(native.gas, CHAIN_GAS_PRICE, 1.1, pool, NATIVE)!
        expect(fee.nativeAmount.eq(native.amount)).toBe(true)
        const spotAmount = native.amount.multipliedBy(pool.reserve_quote).dividedBy(pool.reserve_base)
        expect(fee.amount.eq(spotAmount.multipliedBy(1.1).integerValue(BigNumber.ROUND_CEIL))).toBe(true)
    })

    // Regression: the foreign amount was once converted from the *pre-multiplier* native fee, so it
    // fell short of the chain's requirement for the gas limit actually sent.
    it('covers ceil(gasLimit × 0.01 / spot) for the gas limit it returns', () => {
        const fee = computeForeignGasFee(nativeGas, CHAIN_GAS_PRICE, 1.1, pool, NATIVE)!
        expect(fee.amount.gte(chainForeignRequirement(fee.gas, CHAIN_GAS_PRICE, pool))).toBe(true)
        // Without the buffer the raw spot conversion still meets the rule.
        const noBuffer = computeForeignGasFee(nativeGas, CHAIN_GAS_PRICE, 1, pool, NATIVE)!
        expect(noBuffer.amount.gte(chainForeignRequirement(noBuffer.gas, CHAIN_GAS_PRICE, pool))).toBe(true)
    })

    it('works when the native denom is the pool quote', () => {
        const flipped = { ...pool, base: USDC, quote: NATIVE, reserve_base: pool.reserve_quote, reserve_quote: pool.reserve_base } as LiquidityPoolSDKType
        const fee = computeForeignGasFee(nativeGas, CHAIN_GAS_PRICE, 1.1, flipped, NATIVE)!
        expect(fee.amount.toNumber()).toBe(17)
    })

    it('is at least one unit of the foreign token', () => {
        const fee = computeForeignGasFee(new BigNumber(10), CHAIN_GAS_PRICE, 1.1, pool, NATIVE)!
        expect(fee.amount.toNumber()).toBe(1)
    })

    it('is undefined for a pool that cannot price the fee', () => {
        const empty = { ...pool, reserve_base: '0', reserve_quote: '0' } as LiquidityPoolSDKType
        expect(computeForeignGasFee(nativeGas, CHAIN_GAS_PRICE, 1.1, empty, NATIVE)).toBeUndefined()
    })
})

describe('estimateGasFee', () => {
    it('mirrors useTx.simulateFee for a native fee: ceil(ceil(gas × multiplier) × price)', () => {
        const result = estimateGasFee({ ...env, spec: 'send', txFeeDenom: NATIVE })
        const expected = computeNativeGasFee(GAS_ESTIMATES.send.base, CHAIN_GAS_PRICE, 1.2)
        expect(result.gas.toNumber()).toBe(192_000)               // ceil(160000 × 1.2)
        expect(result.isNative).toBe(true)
        expect(result.denom).toBe(NATIVE)
        expect(result.gas.eq(expected.gas)).toBe(true)
        expect(result.amount.eq(expected.amount)).toBe(true)
        expect(result.nativeAmount.eq(result.amount)).toBe(true)
    })

    it('rounds the gas limit up and the native amount up like useTx', () => {
        // 3 gas × 1.5 = 4.5 → 5 gas; 5 × 0.3 = 1.5 → 2 ubze
        const result = estimateGasFee({ ...env, spec: 'send', txFeeDenom: NATIVE, gasMultiplier: 1.5, gasPrice: 0.3 })
        expect(result.gas.mod(1).isZero()).toBe(true)
        expect(result.amount.mod(1).isZero()).toBe(true)
        expect(result.amount.gte(chainNativeRequirement(result.gas, 0.3))).toBe(true)
    })

    it('converts through the pool with slippage, at the same gas limit as the native fee', () => {
        const result = estimateGasFee({ ...env, spec: 'send', txFeeDenom: USDC, pool })
        const native = estimateGasFee({ ...env, spec: 'send', txFeeDenom: NATIVE })
        const expected = computeForeignGasFee(native.gas, CHAIN_GAS_PRICE, 1.1, pool, NATIVE)!
        expect(result.gas.eq(native.gas)).toBe(true)
        expect(result.nativeAmount.eq(native.amount)).toBe(true)
        expect(result.amount.toNumber()).toBe(22)                 // 1920 ubze → 19.2 uusdc × 1.1 = 21.12 → 22
        expect(result.isNative).toBe(false)
        expect(result.denom).toBe(USDC)
        expect(result.gas.eq(expected.gas)).toBe(true)
        expect(result.nativeAmount.eq(expected.nativeAmount)).toBe(true)
        expect(result.amount.eq(expected.amount)).toBe(true)
        expect(result.amount.mod(1).isZero()).toBe(true)
    })

    it('adds the module fee swap to the gas limit in another token, with one margin', () => {
        const result = estimateGasFee({ ...env, spec: 'create-order', txFeeDenom: USDC, pool })
        // ceil((180000 + 100000) × 1.2)
        expect(result.gas.toNumber()).toBe(Math.ceil((GAS_ESTIMATES['create-order'].base + FEE_SWAP_GAS) * 1.2))
        expect(result.gas.toNumber()).toBe(336_000)
        expect(result.nativeAmount.toNumber()).toBe(3360)
        const native = estimateGasFee({ ...env, spec: 'create-order', txFeeDenom: NATIVE })
        expect(native.gas.toNumber()).toBe(216_000)               // ceil(180000 × 1.2), no swap in ubze
    })

    it('is exactly what useTx would send, and satisfies ceil(gasLimit × 0.01 / spot)', () => {
        const result = estimateGasFee({ ...env, spec: 'ibc-transfer', txFeeDenom: USDC, pool })
        expect(result.amount.gte(chainForeignRequirement(result.gas, CHAIN_GAS_PRICE, pool))).toBe(true)
        // The native fee the estimate reports is the one the returned gas limit needs.
        expect(result.nativeAmount.gte(chainNativeRequirement(result.gas, CHAIN_GAS_PRICE))).toBe(true)
    })

    it('falls back to the native fee without a pool, with a shallow pool, a foreign pool or when the token is BZE', () => {
        expect(estimateGasFee({ ...env, spec: 'send', txFeeDenom: USDC }).isNative).toBe(true)
        expect(estimateGasFee({ ...env, spec: 'send', txFeeDenom: USDC, pool, minNativeLiquidity: pool.reserve_base }).isNative).toBe(true)
        expect(estimateGasFee({ ...env, spec: 'send', txFeeDenom: 'uatom', pool }).isNative).toBe(true)
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

    // 0.1 BZE taker fee, paid in BZE (the fee token, or the fallback when it is short).
    const takerFee = { denom: NATIVE, amount: '100000' }

    it('also leaves the module fee behind when it is paid in the same denom', () => {
        expect(maxSpendableAmount('1000000', NATIVE, gasFee, takerFee).toString()).toBe('895500')
    })

    it('leaves a module fee paid in another denom alone', () => {
        expect(maxSpendableAmount('1000000', USDC, gasFee, takerFee).toString()).toBe('1000000')
        expect(maxSpendableAmount('1000000', USDC, gasFee, { denom: USDC, amount: '300' }).toString()).toBe('999700')
    })

    it('floors at zero when the balance does not cover gas plus module fee', () => {
        expect(maxSpendableAmount('100000', NATIVE, gasFee, takerFee).toString()).toBe('0')
    })

    it('fills an amount canAffordTx accepts with the same gas and module fee', () => {
        // Regression: MAX on the fee coin used to keep only the gas back, so the swap / order
        // form refused its own MAX ("Not enough BZE left for the network fee").
        const balance = '1000000'
        const max = maxSpendableAmount(balance, NATIVE, gasFee, takerFee)
        const result = canAffordTx({
            spend: { denom: NATIVE, amount: max },
            gasFee,
            moduleFee: takerFee,
            balanceOf: () => balance,
        })
        expect(result.canAfford).toBe(true)
        expect(canAffordTx({
            spend: { denom: NATIVE, amount: max.plus(1) },
            gasFee,
            moduleFee: takerFee,
            balanceOf: () => balance,
        }).canAfford).toBe(false)
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
    // A swap pays its output before capturing the taker fee, so the output can pay the fee.
    describe('with coins received before the module fee', () => {
        it('lets the output pay the module fee', () => {
            // Regression: selling USDC into BZE with no BZE left for the taker fee was refused,
            // although the chain takes the fee from the BZE output.
            const sell = { spend: { denom: USDC, amount: '2000' }, gasFee: { denom: USDC, amount: '0' }, moduleFee: { denom: NATIVE, amount: '100000' } }
            const empty = (denom: string) => denom === USDC ? '2000' : '0'
            expect(canAffordTx({ ...sell, balanceOf: empty }).canAfford).toBe(false)
            expect(canAffordTx({ ...sell, receive: { denom: NATIVE, amount: '100000' }, balanceOf: empty }).canAfford).toBe(true)
            const short = canAffordTx({ ...sell, receive: { denom: NATIVE, amount: '99999' }, balanceOf: empty })
            expect(short.canAfford).toBe(false)
            expect(short.shortfalls[0].missing.toString()).toBe('1')
        })

        it('never lets the output pay the spend or the gas', () => {
            const result = canAffordTx({ spend: { denom: NATIVE, amount: '1000000' }, gasFee, receive: { denom: NATIVE, amount: '999999999' }, balanceOf })
            expect(result.canAfford).toBe(false)
            expect(result.shortOnFees).toBe(true)
            expect(result.shortfalls[0].missing.toString()).toBe('4500')
        })
    })
})
