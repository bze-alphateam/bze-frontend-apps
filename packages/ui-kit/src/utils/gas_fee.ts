import BigNumber from "bignumber.js";
import {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";
import {toBigNumber} from "./amount";
import {estimateFeeInPreferredDenom} from "./fee_conversion";
import {FeeCoin} from "../types/fees";

/**
 * Pre-submit gas fee engine.
 *
 * `useTx.simulateFee` is the source of truth for the fee a transaction is sent with, but it
 * can only run at submit time (it needs the signing client and the final messages). Forms
 * need a number *while the user types* — to leave the gas behind on MAX, and to tell the
 * user "you can't afford this" before the wallet pops up. Everything here is pure so it can
 * be unit-tested; the hooks in `src/hooks/useGasFeeEstimate.ts` feed it live chain data.
 *
 * The math mirrors `useTx.simulateFee` step by step:
 *   gas        = gasUsed × gasMultiplier
 *   nativeFee  = gas × gasPrice                                (in the native denom)
 *   foreignFee = poolInput(nativeFee) × foreignFeeSlippage     (when paying in another token)
 *   foreignGas = gas × nonNativeGasMultiplier
 * with `gasUsed` taken from the measured table below instead of a simulation. The foreign
 * amount uses the chain's constant-product input formula (`estimateFeeInPreferredDenom`),
 * which is never below the spot ratio `useTx` uses, so the estimate is never lower than what
 * `useTx` will actually send.
 */

/** Every kind of message the apps send. One entry per message type, not per form. */
export type TxKind =
    | 'send'
    | 'ibc-transfer'
    | 'create-order'
    | 'fill-orders'
    | 'cancel-order'
    | 'swap'
    | 'add-liquidity'
    | 'remove-liquidity'
    | 'create-market'
    | 'create-pool'
    | 'delegate'
    | 'undelegate'
    | 'redelegate'
    | 'withdraw-delegator-reward'
    | 'fund-burner'
    | 'join-raffle'
    | 'create-denom'
    | 'mint'
    | 'burn-tokens'
    | 'set-denom-metadata'
    | 'change-admin'
    | 'create-staking-reward'
    | 'create-trading-reward'
    | 'update-staking-reward'
    | 'join-staking'
    | 'exit-staking'
    | 'claim-staking-reward';

/**
 * Gas profile of a message kind: `base` is the gas one message uses; `perItem`, when set,
 * is the extra gas every additional item costs (orders in a fill, hops in a swap route,
 * validators in a claim, …). See {@link GAS_ESTIMATES} for how the numbers were obtained.
 */
export interface GasProfile {
    base: number;
    perItem?: number;
}

/**
 * Measured `gas_used` per message kind, rounded UP from real transactions (2026-09-09):
 * testnet `bzetestnet-3` for the kinds it had traffic for (create/cancel order, swap) and
 * mainnet `beezee-1` for everything else (p90 of the latest successful single-message txs,
 * plus headroom). Conservative on purpose: `useTx` still simulates the real gas at submit,
 * these only decide how much MAX leaves behind and when to warn — over-estimating by a few
 * thousand gas costs a fraction of a cent, under-estimating fails the transaction.
 *
 * Re-measure when the chain upgrades (`gas_used` of any recent tx of that type, e.g. from
 * the explorer or `GET /cosmos/tx/v1beta1/txs?query=message.action='<type url>'`).
 */
export const GAS_ESTIMATES: Record<TxKind, GasProfile> = {
    'send': {base: 150_000},
    'ibc-transfer': {base: 350_000},
    'create-order': {base: 170_000},
    'fill-orders': {base: 210_000, perItem: 55_000},
    'cancel-order': {base: 100_000},
    'swap': {base: 260_000, perItem: 110_000},
    'add-liquidity': {base: 200_000},
    'remove-liquidity': {base: 200_000},
    'create-market': {base: 200_000},
    'create-pool': {base: 300_000},
    'delegate': {base: 250_000},
    'undelegate': {base: 300_000},
    'redelegate': {base: 400_000},
    'withdraw-delegator-reward': {base: 200_000, perItem: 100_000},
    'fund-burner': {base: 150_000},
    'join-raffle': {base: 150_000},
    'create-denom': {base: 200_000},
    'mint': {base: 150_000},
    'burn-tokens': {base: 150_000},
    'set-denom-metadata': {base: 150_000},
    'change-admin': {base: 120_000},
    'create-staking-reward': {base: 250_000},
    'create-trading-reward': {base: 250_000},
    'update-staking-reward': {base: 150_000},
    'join-staking': {base: 200_000},
    'exit-staking': {base: 200_000},
    'claim-staking-reward': {base: 150_000, perItem: 80_000},
};

/** A message kind with an optional item count (orders, hops, validators, reward ids, …). */
export interface TxKindSpec {
    kind: TxKind;
    /** Number of items in the message; defaults to 1. Only matters for kinds with `perItem`. */
    count?: number;
}

/** What a transaction is made of: one kind, one kind with a count, or several messages. */
export type TxSpec = TxKind | TxKindSpec | Array<TxKind | TxKindSpec>;

function normalizeSpec(spec: TxSpec): TxKindSpec[] {
    const list = Array.isArray(spec) ? spec : [spec];
    return list.map(item => typeof item === 'string' ? {kind: item} : item);
}

/**
 * Raw gas a transaction made of `spec` is expected to use, before the gas multiplier.
 * A multi-message transaction sums its messages' `base` — deliberately conservative
 * (the fixed per-tx overhead is counted once per message).
 */
export function estimateGasUsed(spec: TxSpec): BigNumber {
    return normalizeSpec(spec).reduce((total, {kind, count}) => {
        const profile = GAS_ESTIMATES[kind];
        if (!profile) {
            return total;
        }
        const items = Math.max(1, Math.floor(count ?? 1));
        const extra = profile.perItem ? profile.perItem * (items - 1) : 0;
        return total.plus(profile.base + extra);
    }, toBigNumber(0));
}

/**
 * The gas price `useTx.simulateFee` uses: the chain's `txfeecollector.validator_min_gas_fee`
 * when it is set in the native denom and positive, the env/default price otherwise.
 * Shared so the pre-submit estimate and the submit-time fee can never disagree on it.
 */
export function resolveGasPrice(
    validatorMinGasFee: FeeCoin | undefined,
    nativeDenom: string,
    fallbackGasPrice: number,
): number {
    if (validatorMinGasFee?.denom === nativeDenom) {
        const chainGasPrice = parseFloat(validatorMinGasFee.amount);
        if (!isNaN(chainGasPrice) && chainGasPrice > 0) {
            return chainGasPrice;
        }
    }
    return fallbackGasPrice;
}

export interface GasFeeEstimateInput {
    /** What the transaction is made of. */
    spec: TxSpec;
    /** The chain's native denom (`ubze`). */
    nativeDenom: string;
    /**
     * The denom the transaction fee will be paid in — the Settings fee token when the chain
     * accepts it, else the native denom (see `useTxFeeDenom`).
     */
    txFeeDenom: string;
    /** Gas price in native micro-units per gas (see {@link resolveGasPrice}). */
    gasPrice: number;
    /** `NEXT_PUBLIC_GAS_MULTIPLIER` (useTx: 1.5 by default). */
    gasMultiplier: number;
    /** `NEXT_PUBLIC_NON_NATIVE_GAS_MULTIPLIER`, applied to the gas limit when paying in another token. */
    nonNativeGasMultiplier: number;
    /** `NEXT_PUBLIC_FOREIGN_FEE_SLIPPAGE`, applied to the foreign amount when paying in another token. */
    foreignFeeSlippage: number;
    /** The `txFeeDenom`/`nativeDenom` liquidity pool; required to pay in a non-native token. */
    pool?: LiquidityPoolSDKType;
    /** Tradebin `min_native_liquidity_for_module_swap` — the pool must exceed it to be usable. */
    minNativeLiquidity: BigNumber | string | number;
}

export interface GasFeeEstimate {
    /** Denom the fee is charged in. Equals `nativeDenom` when the preferred token can't be used. */
    denom: string;
    /** Fee amount in micro-units of `denom`, rounded the way `useTx` rounds it. */
    amount: BigNumber;
    /** Gas limit the transaction would be sent with. */
    gas: BigNumber;
    /** The same fee expressed in the native denom (what the network really needs). */
    nativeAmount: BigNumber;
    /** True when the fee is charged in the native denom. */
    isNative: boolean;
}

/**
 * Pre-submit gas fee estimate. Follows `useTx.simulateFee` exactly, with the measured gas
 * table instead of a simulation (see module doc).
 */
export function estimateGasFee(input: GasFeeEstimateInput): GasFeeEstimate {
    const {spec, nativeDenom, txFeeDenom, gasPrice, gasMultiplier, nonNativeGasMultiplier, foreignFeeSlippage, pool, minNativeLiquidity} = input;

    const gas = estimateGasUsed(spec).multipliedBy(gasMultiplier).integerValue(BigNumber.ROUND_CEIL);
    const nativeAmount = gas.multipliedBy(gasPrice).integerValue(BigNumber.ROUND_HALF_UP);
    const native: GasFeeEstimate = {denom: nativeDenom, amount: nativeAmount, gas, nativeAmount, isNative: true};

    if (!txFeeDenom || txFeeDenom === nativeDenom || !pool) {
        return native;
    }

    const converted = estimateFeeInPreferredDenom({
        fee: {denom: nativeDenom, amount: nativeAmount.toFixed(0)},
        nativeDenom,
        preferredDenom: txFeeDenom,
        pool,
        minNativeLiquidity,
    });
    if (converted.reason !== 'estimated' || !converted.preferredAmount || !converted.preferredAmount.gt(0)) {
        return native;
    }

    return {
        denom: txFeeDenom,
        amount: converted.preferredAmount.multipliedBy(foreignFeeSlippage).integerValue(BigNumber.ROUND_CEIL),
        gas: gas.multipliedBy(nonNativeGasMultiplier).integerValue(BigNumber.ROUND_CEIL),
        nativeAmount,
        isNative: false,
    };
}

/** The part of a fee estimate a balance check needs (micro-units). */
export interface GasFeeCoin {
    denom: string;
    amount: BigNumber | string | number;
}

/**
 * How much of `denom` a MAX button may fill in: the balance minus the gas fee when `denom`
 * is the one the fee is paid in (floored at 0), the full balance otherwise.
 */
export function maxSpendableAmount(
    balance: BigNumber | string | number,
    denom: string,
    gasFee?: GasFeeCoin,
): BigNumber {
    const available = toBigNumber(balance);
    if (available.isNaN() || available.lte(0)) {
        return toBigNumber(0);
    }
    if (!gasFee || gasFee.denom !== denom) {
        return available;
    }
    const spendable = available.minus(gasFee.amount);
    return spendable.gt(0) ? spendable : toBigNumber(0);
}

/** A coin leaving the wallet as part of a transaction (micro-units). */
export interface SpendCoin {
    denom: string;
    amount: BigNumber | string | number;
}

export interface CanAffordTxInput {
    /** Everything the transaction itself moves out of the wallet (amount sent, both reserves, …). */
    spend?: SpendCoin | SpendCoin[];
    /** The gas fee the transaction will be sent with. */
    gasFee: GasFeeCoin;
    /**
     * A module fee the message charges (trading fee, creation fee), already resolved to the
     * denom the chain will take it in (`useFeeEstimate` → preferred or native).
     */
    moduleFee?: SpendCoin;
    /** Wallet balance lookup, micro-units. */
    balanceOf: (denom: string) => BigNumber | string | number;
}

export interface TxShortfall {
    denom: string;
    required: BigNumber;
    available: BigNumber;
    missing: BigNumber;
}

export interface CanAffordTxResult {
    canAfford: boolean;
    /** Denoms whose balance does not cover what the transaction needs, largest first. */
    shortfalls: TxShortfall[];
    /** True when the wallet holds enough to cover the spend but not the gas/module fee on top. */
    shortOnFees: boolean;
}

/**
 * Pre-submit affordability check that follows the chain's charging order: the ante handler
 * deducts the gas fee first (in the tx fee denom — no fallback, the tx fails when that
 * balance is short), then the module captures its fee, then the message moves the amount.
 * Per denom the wallet must therefore hold `spend + gas + moduleFee`.
 */
export function canAffordTx(input: CanAffordTxInput): CanAffordTxResult {
    const spends = input.spend ? (Array.isArray(input.spend) ? input.spend : [input.spend]) : [];
    const required = new Map<string, BigNumber>();
    const add = (coin: SpendCoin | undefined) => {
        if (!coin || !coin.denom) return;
        const amount = toBigNumber(coin.amount);
        if (amount.isNaN() || amount.lte(0)) return;
        required.set(coin.denom, (required.get(coin.denom) ?? toBigNumber(0)).plus(amount));
    };
    spends.forEach(add);
    add(input.gasFee);
    add(input.moduleFee);

    const spendOnly = new Map<string, BigNumber>();
    spends.forEach(coin => {
        const amount = toBigNumber(coin.amount);
        if (!coin.denom || amount.isNaN() || amount.lte(0)) return;
        spendOnly.set(coin.denom, (spendOnly.get(coin.denom) ?? toBigNumber(0)).plus(amount));
    });

    const shortfalls: TxShortfall[] = [];
    let spendCovered = true;
    required.forEach((amount, denom) => {
        const availableRaw = toBigNumber(input.balanceOf(denom));
        const available = availableRaw.isNaN() ? toBigNumber(0) : availableRaw;
        if (available.lt(amount)) {
            shortfalls.push({denom, required: amount, available, missing: amount.minus(available)});
        }
        const spend = spendOnly.get(denom);
        if (spend && available.lt(spend)) {
            spendCovered = false;
        }
    });
    shortfalls.sort((a, b) => b.missing.comparedTo(a.missing) ?? 0);

    return {
        canAfford: shortfalls.length === 0,
        shortfalls,
        shortOnFees: shortfalls.length > 0 && spendCovered,
    };
}
