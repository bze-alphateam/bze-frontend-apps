import BigNumber from "bignumber.js";
import {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";
import {toBigNumber} from "./amount";
import {calculatePoolOppositeAmount} from "./liquidity_pool";
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
 * The math is shared with `useTx.simulateFee` ({@link computeNativeGasFee} and
 * {@link computeForeignGasFee} are what it calls), with `gasUsed` taken from the measured
 * table below instead of a simulation. The chain rules it satisfies (x/txfeecollector ante,
 * `DeductFeeDecorator`):
 *   native:  fee >= ceil(gasLimit × minGasPrice)
 *   foreign: fee >= ceil(gasLimit × minGasPrice / spot),  spot = nativeReserve / foreignReserve
 * so
 *   gas        = ceil(gasUsed × gasMultiplier)                         (the same limit in every fee token)
 *   nativeFee  = ceil(gas × gasPrice)                                   (paying in the native denom)
 *   foreignFee = ceil(spot⁻¹(ceil(gas × gasPrice)) × foreignFeeSlippage) (paying in another token)
 * Every rounding is up: a fee one micro-unit short is rejected with "insufficient fees".
 *
 * One gas margin serves every fee token. The simulation carries the fee denom
 * (`utils/simulation.ts`), so it already measures what paying in another token costs: the
 * network fee is only moved to the txfeecollector module in the tx (it is swapped to the native
 * denom in that module's EndBlock, outside the tx's gas), and a module fee (trading fee,
 * creation fee) is captured and swapped through the token's pool inside the tx, which the
 * simulation runs too. The slippage buffer absorbs pool drift between simulation and inclusion.
 *
 * The measured table below comes from transactions paid in the native denom, so it holds no
 * module-fee swap. When the fee is paid in another token, {@link estimateGasUsed} adds
 * {@link FEE_SWAP_GAS} for every module fee the message captures, keeping the estimate at or
 * above what `simulateFee` sends.
 */

/** Every kind of message the apps send. One entry per message type, not per form. */
export type TxKind =
    | 'send'
    | 'multi-send'
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
    | 'start-raffle'
    | 'create-denom'
    | 'mint'
    | 'burn-tokens'
    | 'set-denom-metadata'
    | 'change-admin'
    | 'set-denom-branding'
    | 'create-staking-reward'
    | 'create-trading-reward'
    | 'update-staking-reward'
    | 'delete-staking-reward'
    | 'distribute-staking-rewards'
    | 'join-staking'
    | 'exit-staking'
    | 'claim-staking-reward'
    | 'create-denom-reward'
    | 'create-denom-reward-schedule'
    | 'update-denom-reward-schedule'
    | 'distribute-denom-rewards'
    | 'join-denom-reward'
    | 'claim-denom-rewards'
    | 'exit-denom-reward'
    | 'vote';

/**
 * Gas profile of a message kind: `base` is the gas one message uses; `perItem`, when set,
 * is the extra gas every additional item costs (orders in a fill, hops in a swap route,
 * validators in a claim, …); `feeSwaps`, when set, is how many module fees the message
 * captures through the chain's `CaptureAndSwapUserFee` (swapped in the tx when paid in another
 * token, see {@link FEE_SWAP_GAS}). See {@link GAS_ESTIMATES} for how the numbers were obtained.
 */
export interface GasProfile {
    base: number;
    perItem?: number;
    feeSwaps?: number;
}

/**
 * Extra gas of one module fee captured in another token and swapped to the native denom
 * through that token's pool, inside the tx. From the BZE testnet numbers in
 * `utils/simulation.ts`: create denom reward paid in another token executed ~175k against
 * ~77k simulated without a fee, of which ~20k is the ante fee transfer, so ~80k per swap;
 * rounded up for headroom.
 */
export const FEE_SWAP_GAS = 100_000;

/**
 * `gas_used` per message kind, rounded UP with headroom from real transactions (2026-09-09):
 * testnet `bzetestnet-3` for the kinds it had traffic for (create/cancel order), mainnet
 * `beezee-1` for everything else — p90/max of the latest successful single-message txs.
 * Kinds marked "no on-chain sample" had no transaction to measure yet and carry a generous
 * estimate instead. Conservative on purpose: `useTx` still simulates the real gas at submit,
 * these only decide how much MAX leaves behind and when to warn — over-estimating by a few
 * thousand gas costs a fraction of a cent, under-estimating fails the transaction.
 *
 * The samples paid their network fee in the native denom, so module fees were captured without
 * a swap; `feeSwaps` marks the kinds that need {@link FEE_SWAP_GAS} on top in another token.
 *
 * Re-measure when the chain upgrades (`gas_used` of recent txs of that type, e.g. from the
 * explorer or `GET /cosmos/tx/v1beta1/txs?query=message.action='/bze.tradebin.MsgCreateOrder'`
 * — BZE type URLs have no version segment).
 */
export const GAS_ESTIMATES: Record<TxKind, GasProfile> = {
    'send': {base: 160_000},                                  // measured p90 123k, max 146k
    'multi-send': {base: 200_000, perItem: 35_000},           // no on-chain sample — bank send of one output measured p90 123k; estimate with headroom, re-measure on bzetestnet-3
    'ibc-transfer': {base: 450_000},                          // measured p90 330k, max 419k
    'create-order': {base: 180_000, feeSwaps: 1},             // measured (testnet) p90 155k, max 162k
    'fill-orders': {base: 220_000, perItem: 60_000, feeSwaps: 1}, // measured 2 orders 240k … 15 orders 961k
    'cancel-order': {base: 100_000},                          // measured (testnet) 84k
    'swap': {base: 260_000, perItem: 60_000, feeSwaps: 1},    // measured 1 hop 224k–242k, 2 hops 251k
    'add-liquidity': {base: 220_000},                         // measured p90 194k, max 201k
    'remove-liquidity': {base: 220_000},                      // measured max 203k
    'create-market': {base: 220_000, feeSwaps: 1},            // measured 165k (single sample)
    'create-pool': {base: 300_000, feeSwaps: 1},              // measured max 252k
    'delegate': {base: 260_000},                              // measured p90 233k, max 241k
    'undelegate': {base: 320_000},                            // measured p90 275k, max 284k
    'redelegate': {base: 460_000},                            // measured p90 404k, max 425k
    'withdraw-delegator-reward': {base: 200_000, perItem: 120_000}, // measured max 179k per message
    'fund-burner': {base: 160_000},                           // measured p90 133k, max 147k
    'join-raffle': {base: 600_000},                           // measured median 207k, max 559k (varies with tickets)
    'start-raffle': {base: 200_000},                          // no on-chain sample — denom/raffle lookups + pot capture + two writes; re-measure on bzetestnet-3
    'create-denom': {base: 300_000, feeSwaps: 1},             // no on-chain sample — estimate with headroom
    'mint': {base: 200_000},                                  // no on-chain sample — estimate with headroom
    'burn-tokens': {base: 200_000},                           // no on-chain sample — estimate with headroom
    'set-denom-metadata': {base: 200_000},                    // no on-chain sample — estimate with headroom
    'change-admin': {base: 150_000},                          // no on-chain sample — estimate with headroom
    'set-denom-branding': {base: 200_000},                    // no on-chain sample (chain v8.2.0) — admin check + one small record write + event; re-measure on bzetestnet-3
    'create-staking-reward': {base: 300_000, feeSwaps: 1},    // no on-chain sample — estimate with headroom
    'create-trading-reward': {base: 300_000, feeSwaps: 1},    // no on-chain sample — estimate with headroom
    'update-staking-reward': {base: 160_000},                 // measured max 137k
    'delete-staking-reward': {base: 200_000},                 // no on-chain sample (chain v8.2.0) — one record removal + event; re-measure on bzetestnet-3
    'distribute-staking-rewards': {base: 180_000},            // no on-chain sample — one capture + one record write, like update-staking-reward (137k)
    'join-staking': {base: 200_000},                          // measured p90 162k
    'exit-staking': {base: 1_200_000},                        // measured median 142k but up to 1.14M
    'claim-staking-reward': {base: 170_000, perItem: 100_000}, // measured max 147k per message
    // Denom Rewards (chain v8.2.0): no on-chain sample yet — estimates with headroom, sized from the
    // staking-reward equivalents above. Re-measure on bzetestnet-3 once it runs v8.2.0.
    'create-denom-reward': {base: 300_000, feeSwaps: 1},      // no on-chain sample — fee capture-and-swap, like create-staking-reward
    'create-denom-reward-schedule': {base: 350_000, feeSwaps: 2}, // no on-chain sample — escrow + schedule fee + (new prize) prize fee captures
    'update-denom-reward-schedule': {base: 180_000},          // no on-chain sample — escrow only, like update-staking-reward (137k)
    'distribute-denom-rewards': {base: 300_000, perItem: 60_000, feeSwaps: 1}, // no on-chain sample — per prize coin; a new prize denom adds a fee capture
    'join-denom-reward': {base: 250_000},                     // no on-chain sample — settles every prize accumulator of the DR
    'claim-denom-rewards': {base: 250_000},                   // no on-chain sample — settles every prize accumulator of the DR
    // The keeper consumes the extra_gas_for_denom_exit param (default 1,000,000) on every exit, on
    // top of the message's own ~200k — the same scheme as exit-staking / extra_gas_for_exit_stake.
    'exit-denom-reward': {base: 1_200_000},                   // no on-chain sample — 200k base + 1M extra_gas_for_denom_exit
    'vote': {base: 120_000},                                  // measured mainnet p100 94k over the last 30 MsgVote txs, 2026-10-17
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

export interface EstimateGasUsedOptions {
    /**
     * The fee is paid in a token other than the native denom: every module fee the messages
     * capture is swapped in the tx, so {@link FEE_SWAP_GAS} is added per `feeSwaps`.
     */
    foreignFee?: boolean;
}

/**
 * Raw gas a transaction made of `spec` is expected to use, before the gas multiplier.
 * A multi-message transaction sums its messages' `base` — deliberately conservative
 * (the fixed per-tx overhead is counted once per message).
 */
export function estimateGasUsed(spec: TxSpec, options?: EstimateGasUsedOptions): BigNumber {
    return normalizeSpec(spec).reduce((total, {kind, count}) => {
        const profile = GAS_ESTIMATES[kind];
        if (!profile) {
            return total;
        }
        const items = Math.max(1, Math.floor(count ?? 1));
        const extra = profile.perItem ? profile.perItem * (items - 1) : 0;
        const swaps = options?.foreignFee && profile.feeSwaps ? profile.feeSwaps * FEE_SWAP_GAS : 0;
        return total.plus(profile.base + extra + swaps);
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

/** Gas limit and fee of a transaction paid in the native denom. */
export interface NativeGasFee {
    /** Gas limit the transaction is sent with: `ceil(gasUsed × gasMultiplier)`. */
    gas: BigNumber;
    /** Fee in native micro-units: `ceil(gas × gasPrice)`, the chain's minimum. */
    amount: BigNumber;
}

/**
 * The native gas fee `useTx.simulateFee` sends: the gas limit is rounded up first, then the fee
 * is `ceil(gasLimit × gasPrice)` — exactly the ante handler's `fee >= ceil(gasLimit × minGasPrice)`.
 * Rounding half-up would be one micro-unit short whenever `gasLimit × gasPrice` ends in .01–.49
 * (gasUsed 123410 → gas 185115 → 1851.15: the chain requires 1852).
 */
export function computeNativeGasFee(
    gasUsed: BigNumber | string | number,
    gasPrice: number,
    gasMultiplier: number,
): NativeGasFee {
    const gas = toBigNumber(gasUsed).multipliedBy(gasMultiplier).integerValue(BigNumber.ROUND_CEIL);
    const amount = gas.multipliedBy(gasPrice).integerValue(BigNumber.ROUND_CEIL);
    return {gas, amount};
}

/** Gas limit and fee of a transaction paid in a non-native token. */
export interface ForeignGasFee {
    /** Gas limit the transaction is sent with: the native gas limit, unchanged. */
    gas: BigNumber;
    /** Fee in micro-units of the foreign denom, slippage buffer included. */
    amount: BigNumber;
    /** The native fee that gas limit needs — `ceil(gas × gasPrice)` — which the foreign fee covers. */
    nativeAmount: BigNumber;
}

/**
 * The fee `useTx.simulateFee` sends when the user pays in another token. The chain prices gas
 * in that token at `minGasPrice / spot`, where `spot = nativeReserve / foreignReserve` of the
 * token's pool with the native denom (x/tradebin `GetDenomSpotPriceInNativeCoin`), and requires
 * `fee >= ceil(gasLimit × minGasPrice / spot)`. The gas limit is the one of
 * {@link computeNativeGasFee} — no second margin: the simulation already ran with the fee in
 * this token (see module doc) — so the fee is `ceil(gas × gasPrice)` native, converted at the
 * spot ratio, times the slippage buffer, rounded up.
 *
 * `nativeGas` is the gas limit of {@link computeNativeGasFee}. Returns undefined when the pool
 * cannot price the fee (empty reserves), in which case the native fee must be sent instead.
 */
export function computeForeignGasFee(
    nativeGas: BigNumber,
    gasPrice: number,
    foreignFeeSlippage: number,
    pool: LiquidityPoolSDKType,
    nativeDenom: string,
): ForeignGasFee | undefined {
    const gas = nativeGas.integerValue(BigNumber.ROUND_CEIL);
    const nativeAmount = gas.multipliedBy(gasPrice).integerValue(BigNumber.ROUND_CEIL);
    // spot⁻¹: native amount × foreignReserve / nativeReserve
    const spot = calculatePoolOppositeAmount(pool, nativeAmount, pool.base === nativeDenom);
    if (spot.isNaN() || !spot.gt(0)) {
        return undefined;
    }
    // ROUND_CEIL also guarantees at least 1 unit of the foreign denom; if the swap rounds to 0
    // on-chain, the txfeecollector module accumulates the dust until it can be swapped.
    const amount = spot.multipliedBy(foreignFeeSlippage).integerValue(BigNumber.ROUND_CEIL);
    return {gas, amount, nativeAmount};
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
    /** `NEXT_PUBLIC_GAS_MULTIPLIER` (useTx: 1.2 by default), the same for every fee token. */
    gasMultiplier: number;
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
    /** Fee amount in micro-units of `denom`, rounded up the way `useTx` rounds it. */
    amount: BigNumber;
    /** Gas limit the transaction would be sent with. */
    gas: BigNumber;
    /** The same fee expressed in the native denom (what the network really needs). */
    nativeAmount: BigNumber;
    /** True when the fee is charged in the native denom. */
    isNative: boolean;
}

/**
 * Pre-submit gas fee estimate. Follows `useTx.simulateFee`, with the measured gas table instead
 * of a simulation (see module doc). In another token the table gets {@link FEE_SWAP_GAS} per
 * captured module fee, which the simulation measures and the native-paid samples lack.
 */
export function estimateGasFee(input: GasFeeEstimateInput): GasFeeEstimate {
    const {spec, nativeDenom, txFeeDenom, gasPrice, gasMultiplier, foreignFeeSlippage, pool, minNativeLiquidity} = input;

    const {gas, amount: nativeAmount} = computeNativeGasFee(estimateGasUsed(spec), gasPrice, gasMultiplier);
    const native: GasFeeEstimate = {denom: nativeDenom, amount: nativeAmount, gas, nativeAmount, isNative: true};

    if (!txFeeDenom || txFeeDenom === nativeDenom || !pool || !poolAcceptsFeeDenom(pool, nativeDenom, txFeeDenom, minNativeLiquidity)) {
        return native;
    }

    const foreignGas = computeNativeGasFee(estimateGasUsed(spec, {foreignFee: true}), gasPrice, gasMultiplier).gas;
    const foreign = computeForeignGasFee(foreignGas, gasPrice, foreignFeeSlippage, pool, nativeDenom);
    if (!foreign) {
        return native;
    }

    return {
        denom: txFeeDenom,
        amount: foreign.amount,
        gas: foreign.gas,
        nativeAmount: foreign.nativeAmount,
        isNative: false,
    };
}

/**
 * Same rule as `useFeeTokens.isValidFeeDenom` / the chain's `HasDeepLiquidityWithNativeDenom`:
 * the token's pool with the native denom must hold *more* than the minimum native liquidity.
 */
function poolAcceptsFeeDenom(
    pool: LiquidityPoolSDKType,
    nativeDenom: string,
    feeDenom: string,
    minNativeLiquidity: BigNumber | string | number,
): boolean {
    const pairs = (pool.base === nativeDenom && pool.quote === feeDenom) || (pool.base === feeDenom && pool.quote === nativeDenom);
    if (!pairs) {
        return false;
    }
    const nativeReserve = toBigNumber(pool.base === nativeDenom ? pool.reserve_base : pool.reserve_quote);
    return nativeReserve.gt(toBigNumber(minNativeLiquidity));
}

/** The part of a fee estimate a balance check needs (micro-units). */
export interface GasFeeCoin {
    denom: string;
    amount: BigNumber | string | number;
}

/**
 * How much of `denom` a MAX button may fill in: the balance minus the gas fee and the module
 * fee, each only when it is paid in `denom` (floored at 0). `moduleFee` must already be
 * resolved to the denom the chain will take it in (`useFeeEstimate`'s `resolvedFee`), so the
 * result is exactly what `canAffordTx` accepts for the same fees.
 */
export function maxSpendableAmount(
    balance: BigNumber | string | number,
    denom: string,
    gasFee?: GasFeeCoin,
    moduleFee?: GasFeeCoin,
): BigNumber {
    const available = toBigNumber(balance);
    if (available.isNaN() || available.lte(0)) {
        return toBigNumber(0);
    }
    const reserved = [gasFee, moduleFee]
        .filter((fee): fee is GasFeeCoin => fee !== undefined && fee.denom === denom)
        .reduce((sum, fee) => {
            const amount = toBigNumber(fee.amount);
            return amount.isNaN() || amount.lte(0) ? sum : sum.plus(amount);
        }, toBigNumber(0));
    const spendable = available.minus(reserved);
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
    /**
     * Coins the message pays into the wallet before it captures the module fee (a swap's
     * minimum output). They can cover the module fee, never the spend or the gas.
     */
    receive?: SpendCoin | SpendCoin[];
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
 * balance is short), then the message moves the amount and captures its fee. Per denom the
 * wallet must therefore hold `spend + gas + moduleFee`. Coins in `receive` (a swap's output,
 * paid before the fee is captured) count toward the module fee only: per denom the wallet
 * must hold `spend + gas`, and `spend + gas + moduleFee` once `receive` has landed.
 */
export function canAffordTx(input: CanAffordTxInput): CanAffordTxResult {
    const spends = input.spend ? (Array.isArray(input.spend) ? input.spend : [input.spend]) : [];
    const receives = input.receive ? (Array.isArray(input.receive) ? input.receive : [input.receive]) : [];
    const total = (coins: Array<SpendCoin | undefined>) => {
        const sums = new Map<string, BigNumber>();
        coins.forEach(coin => {
            if (!coin || !coin.denom) return;
            const amount = toBigNumber(coin.amount);
            if (amount.isNaN() || amount.lte(0)) return;
            sums.set(coin.denom, (sums.get(coin.denom) ?? toBigNumber(0)).plus(amount));
        });
        return sums;
    };
    const beforeFee = total([...spends, input.gasFee]);
    const required = total([...spends, input.gasFee, input.moduleFee]);
    const received = total(receives);
    const spendOnly = total(spends);

    const shortfalls: TxShortfall[] = [];
    let spendCovered = true;
    required.forEach((amount, denom) => {
        const availableRaw = toBigNumber(input.balanceOf(denom));
        const balance = availableRaw.isNaN() ? toBigNumber(0) : availableRaw;
        const zero = toBigNumber(0);
        const available = balance.plus(received.get(denom) ?? zero);
        const missing = BigNumber.max(amount.minus(available), (beforeFee.get(denom) ?? zero).minus(balance), zero);
        if (missing.gt(0)) {
            shortfalls.push({denom, required: amount, available, missing});
        }
        const spend = spendOnly.get(denom);
        if (spend && balance.lt(spend)) {
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
