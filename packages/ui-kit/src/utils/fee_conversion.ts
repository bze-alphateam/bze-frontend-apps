import BigNumber from "bignumber.js";
import {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";
import {toBigNumber} from "./amount";
import {FeeCoin} from "../types/fees";

/**
 * Fee conversion engine — mirrors how the chain charges a native-denominated fee
 * (trading maker/taker fees, creation fees, …) when the user pays transaction fees
 * in a different token (Settings → fee token).
 *
 * Chain behaviour (x/tradebin `CaptureAndTryToSwapUserFeesOrSendItAsIs`):
 *   1. The tx fee denom becomes the "preferred" denom for every fee in that tx.
 *   2. If preferred == native there is nothing to convert.
 *   3. The chain looks up the preferred/native liquidity pool. No pool, or native
 *      reserve below the minimum-liquidity param → the fee is charged in native.
 *   4. Otherwise it computes the exact pool input needed to obtain the native fee
 *      (constant product, pool swap fee included, rounded up) and, if the payer holds
 *      that much of the preferred token, captures it and swaps it to native.
 *      If the balance is short → falls back to charging the native fee.
 *
 * Everything here is pure so it can be unit-tested and shared by every app.
 */

/**
 * Input of the pool's *other* denom a constant-product swap needs in order to output
 * exactly `outputAmount` of `outputDenom`, pool swap fee included, rounded up to a whole
 * micro-unit. Port of the chain's `CalculateOptimalInputForOutput`.
 *
 * Returns undefined when the pool cannot serve the request: unknown denom, empty
 * reserves, non-positive output, output >= reserve, or a fee of 100 % or more.
 */
export function calculateOptimalInputForOutput(
    pool: LiquidityPoolSDKType,
    outputDenom: string,
    outputAmount: BigNumber | string | number,
): BigNumber | undefined {
    const output = toBigNumber(outputAmount);
    if (output.isNaN() || !output.gt(0)) {
        return undefined;
    }

    let outputReserve: BigNumber;
    let inputReserve: BigNumber;
    if (outputDenom === pool.base) {
        outputReserve = toBigNumber(pool.reserve_base);
        inputReserve = toBigNumber(pool.reserve_quote);
    } else if (outputDenom === pool.quote) {
        outputReserve = toBigNumber(pool.reserve_quote);
        inputReserve = toBigNumber(pool.reserve_base);
    } else {
        return undefined;
    }

    if (!outputReserve.gt(0) || !inputReserve.gt(0)) {
        return undefined;
    }

    if (output.gte(outputReserve)) {
        return undefined;
    }

    const feeMultiplier = toBigNumber(1).minus(toBigNumber(pool.fee || 0));
    if (!feeMultiplier.gt(0)) {
        return undefined;
    }

    // real_input = output * input_reserve / (output_reserve - output)
    const realInput = output.multipliedBy(inputReserve).dividedBy(outputReserve.minus(output));
    // input = real_input / (1 - fee), rounded up so the swap yields at least the output
    const input = realInput.dividedBy(feeMultiplier).integerValue(BigNumber.ROUND_CEIL);

    return input.gt(0) ? input : undefined;
}

/**
 * Why a fee estimate ended up the way it did.
 *
 * - `native`         — the preferred fee token is the native coin (or the fee is not
 *                      denominated in the native coin): charged exactly as set on chain.
 * - `estimated`      — the preferred token can be used; `preferredAmount` is the estimate.
 * - `no-pool`        — no liquidity pool between the preferred token and the native coin.
 * - `low-liquidity`  — the pool's native reserve is below the chain's minimum for fee swaps.
 * - `pool-too-small` — the pool cannot output the fee amount (reserve too small).
 *
 * Every reason other than `estimated` means the chain charges the fee in its native denom.
 */
export type FeeEstimateReason = 'native' | 'estimated' | 'no-pool' | 'low-liquidity' | 'pool-too-small';

export interface FeeEstimateInput {
    /** The fee exactly as the chain defines it (native micro-denom amount). */
    fee: FeeCoin;
    /** The chain's native denom (e.g. `ubze`). */
    nativeDenom: string;
    /** The user's preferred fee denom from Settings. */
    preferredDenom: string;
    /** The liquidity pool between `preferredDenom` and `nativeDenom`, when one exists. */
    pool?: LiquidityPoolSDKType;
    /**
     * Minimum native reserve the pool must hold for the chain to accept the preferred
     * denom as a fee token (tradebin `min_native_liquidity_for_module_swap`).
     */
    minNativeLiquidity: BigNumber | string | number;
}

export interface FeeEstimate {
    reason: FeeEstimateReason;
    /** Denom the chain charges when it does not use the preferred token — the fee's own denom. */
    nativeDenom: string;
    /** The fee amount in `nativeDenom` (micro-units). Always set. */
    nativeAmount: BigNumber;
    /** The preferred fee denom the estimate was made for. */
    preferredDenom: string;
    /**
     * Estimated micro-amount of `preferredDenom` the chain will take instead of the native
     * fee. Only set when `reason === 'estimated'`. It is an estimate: the chain recomputes
     * it from the pool at execution time.
     */
    preferredAmount?: BigNumber;
}

/**
 * Estimates how much of the user's preferred fee token a native-denominated fee costs,
 * following the chain's charging rules (see module doc). Pure and side-effect free.
 */
export function estimateFeeInPreferredDenom(input: FeeEstimateInput): FeeEstimate {
    const {fee, nativeDenom, preferredDenom, pool, minNativeLiquidity} = input;
    const nativeAmount = toBigNumber(fee.amount);
    const base: FeeEstimate = {
        reason: 'native',
        nativeDenom: fee.denom,
        nativeAmount: nativeAmount.isNaN() ? toBigNumber(0) : nativeAmount,
        preferredDenom,
    };

    // Nothing to convert: same denom, or a fee that is not in the native coin at all
    // (the chain captures such fees as-is).
    if (!preferredDenom || preferredDenom === nativeDenom || fee.denom !== nativeDenom) {
        return base;
    }

    if (!pool || !poolHasDenoms(pool, nativeDenom, preferredDenom)) {
        return {...base, reason: 'no-pool'};
    }

    const nativeReserve = toBigNumber(pool.base === nativeDenom ? pool.reserve_base : pool.reserve_quote);
    // Same rule as useFeeTokens / the chain's HasDeepLiquidityWithNativeDenom: the pool
    // must hold more than the minimum native liquidity for the denom to be fee-eligible.
    if (!nativeReserve.gt(toBigNumber(minNativeLiquidity))) {
        return {...base, reason: 'low-liquidity'};
    }

    const preferredAmount = calculateOptimalInputForOutput(pool, nativeDenom, base.nativeAmount);
    if (!preferredAmount) {
        return {...base, reason: 'pool-too-small'};
    }

    return {...base, reason: 'estimated', preferredAmount};
}

/**
 * Which balance the chain will actually take the fee from, mirroring its charging order.
 *
 * - `native`       — preferred token not in play; native balance covers the fee.
 * - `preferred`    — preferred token selected and its balance covers the estimate.
 * - `fallback`     — preferred token selected but short; the chain charges native instead
 *                    and the native balance covers it.
 * - `insufficient` — neither balance covers the fee.
 */
export type FeePaymentMethod = 'native' | 'preferred' | 'fallback' | 'insufficient';

/**
 * Balance already spoken for before the module fee is charged — the transaction's gas fee,
 * which the ante handler deducts first. Micro-units of the respective denom.
 */
export interface FeeReserves {
    /** Reserved from the native balance (gas paid in the native coin). */
    reservedNative?: BigNumber | string | number;
    /** Reserved from the preferred-token balance (gas paid in the preferred token). */
    reservedPreferred?: BigNumber | string | number;
}

function reservedAmount(value: BigNumber | string | number | undefined): BigNumber {
    if (value === undefined) {
        return toBigNumber(0);
    }
    const reserved = toBigNumber(value);
    return reserved.isNaN() || reserved.lt(0) ? toBigNumber(0) : reserved;
}

/**
 * Which balance the chain takes the module fee from, given optional reserves (the gas fee,
 * deducted first). A reserve larger than its balance means the gas itself cannot be paid:
 * the ante handler rejects the transaction outright, so the result is `insufficient`
 * regardless of the other balance.
 */
export function resolveFeePayment(
    estimate: FeeEstimate,
    preferredBalance: BigNumber | string | number,
    nativeBalance: BigNumber | string | number,
    reserves: FeeReserves = {},
): FeePaymentMethod {
    const reservedNative = reservedAmount(reserves.reservedNative);
    const reservedPreferred = reservedAmount(reserves.reservedPreferred);
    const native = toBigNumber(nativeBalance);
    const preferred = toBigNumber(preferredBalance);

    // Gas must be payable before anything else happens.
    if (native.lt(reservedNative) || preferred.lt(reservedPreferred)) {
        return 'insufficient';
    }

    const hasEnoughNative = native.minus(reservedNative).gte(estimate.nativeAmount);

    if (estimate.reason === 'estimated' && estimate.preferredAmount) {
        if (preferred.minus(reservedPreferred).gte(estimate.preferredAmount)) {
            return 'preferred';
        }
        return hasEnoughNative ? 'fallback' : 'insufficient';
    }

    return hasEnoughNative ? 'native' : 'insufficient';
}

function poolHasDenoms(pool: LiquidityPoolSDKType, denomA: string, denomB: string): boolean {
    return (pool.base === denomA && pool.quote === denomB) || (pool.base === denomB && pool.quote === denomA);
}
