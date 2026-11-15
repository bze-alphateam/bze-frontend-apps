import BigNumber from 'bignumber.js';
import {MsgSetWithdrawAddress} from '@bze/bzejs/cosmos/distribution/v1beta1/tx';
import {AuthInfo, Fee, SignerInfo, Tx, TxBody} from '@bze/bzejs/cosmos/tx/v1beta1/tx';
import type {StdFee} from '@bze/bzejs/types';

/**
 * AtomOne withdraw-address helper: the pure parts of the hidden
 * `/atomone-withdraw-address` page (REST queries, fee maths, simulation bytes).
 * Self-contained so the page can be removed by deleting its route, its
 * component folder and this file.
 */

export const ATOMONE_CHAIN_NAME = 'atomone';
export const ATOMONE_PREFIX = 'atone';
export const SET_WITHDRAW_ADDRESS_TYPE_URL = '/cosmos.distribution.v1beta1.MsgSetWithdrawAddress';

/**
 * AtomOne's photon module only accepts fees in PHOTON (`uphoton`); ATOM ONE (`uatone`) pays
 * only for MsgMintPhoton (chain param `tx_fee_exceptions`).
 */
export const ATOMONE_FEE_DENOM = 'uphoton';
export const PHOTON_DECIMALS = 6;
/** Floor for the gas price: chain-registry's `fixedMinGasPrice` for uphoton, also the validators' default. */
export const ATOMONE_MIN_GAS_PRICE = 0.225;
export const ATOMONE_GAS_MULTIPLIER = 1.3;
/** Headroom on the dynamic gas price, which can rise between the estimate and the signature. */
export const ATOMONE_GAS_PRICE_BUFFER = 1.1;
/** Sent with both the simulation and the signed tx, so the measured gas matches. */
export const ATOMONE_TX_MEMO = '';

const DEFAULT_EXPLORER_TX_PAGE = 'https://explorer.allinbits.com/atomone/tx/${txHash}';

export type FetchFn = typeof fetch;

export function buildSetWithdrawAddressMsg(delegatorAddress: string, withdrawAddress: string) {
    return {
        typeUrl: SET_WITHDRAW_ADDRESS_TYPE_URL,
        value: MsgSetWithdrawAddress.fromPartial({delegatorAddress, withdrawAddress}),
    };
}

/** The explorer page of a tx, from a chain-registry `txPage` template. */
export function explorerTxUrl(txHash: string, txPageTemplate?: string): string {
    return (txPageTemplate || DEFAULT_EXPLORER_TX_PAGE).replace('${txHash}', txHash);
}

/**
 * The gas price to pay: the dynamic fee module's current price plus a 10% buffer, never below
 * the static minimum validators enforce in their mempool.
 */
export function effectiveGasPrice(dynamicPrice: number | undefined): number {
    if (dynamicPrice === undefined || !Number.isFinite(dynamicPrice) || dynamicPrice <= 0) {
        return ATOMONE_MIN_GAS_PRICE;
    }
    return Math.max(dynamicPrice * ATOMONE_GAS_PRICE_BUFFER, ATOMONE_MIN_GAS_PRICE);
}

/** gas = ceil(gasUsed × multiplier), amount = ceil(gas × price), in uphoton. */
export function computeAtomOneFee(gasUsed: number, gasPrice: number, multiplier: number = ATOMONE_GAS_MULTIPLIER): StdFee {
    if (!Number.isFinite(gasUsed) || gasUsed <= 0) {
        throw new Error('Gas simulation returned no gas');
    }
    const gas = new BigNumber(gasUsed).multipliedBy(multiplier).integerValue(BigNumber.ROUND_CEIL);
    const amount = gas.multipliedBy(gasPrice).integerValue(BigNumber.ROUND_CEIL);
    return {
        amount: [{denom: ATOMONE_FEE_DENOM, amount: amount.toFixed(0)}],
        gas: gas.toFixed(0),
    };
}

/** The unsigned tx sent to `/cosmos/tx/v1beta1/simulate`, carrying a 1 uphoton fee so the fee checks run. */
export function buildSimulationTxBytes(delegatorAddress: string, withdrawAddress: string, sequence: bigint): Uint8Array {
    const msg = MsgSetWithdrawAddress.fromPartial({delegatorAddress, withdrawAddress});
    const body = TxBody.fromPartial({
        messages: [{typeUrl: SET_WITHDRAW_ADDRESS_TYPE_URL, value: MsgSetWithdrawAddress.encode(msg).finish()}],
        memo: ATOMONE_TX_MEMO,
    });
    const authInfo = AuthInfo.fromPartial({
        signerInfos: [SignerInfo.fromPartial({modeInfo: {single: {mode: 1}}, sequence})],
        fee: Fee.fromPartial({amount: [{denom: ATOMONE_FEE_DENOM, amount: '1'}], gasLimit: BigInt(0)}),
    });
    return Tx.encode(Tx.fromPartial({body, authInfo, signatures: [new Uint8Array(0)]})).finish();
}

export function toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
}

const trimBase = (restUrl: string) => restUrl.replace(/\/+$/, '');

async function getJson<T>(fetchFn: FetchFn, url: string, init?: RequestInit): Promise<T | undefined> {
    const res = await fetchFn(url, init);
    const body: unknown = await res.json().catch(() => undefined);
    if (!res.ok) {
        throw new Error((body as {message?: string} | undefined)?.message || `Request failed (${res.status})`);
    }
    return body as T | undefined;
}

interface AccountJson {
    sequence?: string;
    base_account?: {sequence?: string};
    base_vesting_account?: {base_account?: {sequence?: string}};
}

/** The address the account's staking rewards are paid to (the account itself unless changed). */
export async function fetchWithdrawAddress(restUrl: string, address: string, fetchFn: FetchFn = fetch): Promise<string> {
    const body = await getJson<{withdraw_address?: string}>(fetchFn, `${trimBase(restUrl)}/cosmos/distribution/v1beta1/delegators/${address}/withdraw_address`);
    const withdraw = body?.withdraw_address;
    if (typeof withdraw !== 'string' || withdraw === '') {
        throw new Error('Unexpected withdraw address response');
    }
    return withdraw;
}

/** The account's balance of `denom` in base units, '0' when it holds none. */
export async function fetchBalance(restUrl: string, address: string, denom: string, fetchFn: FetchFn = fetch): Promise<string> {
    const body = await getJson<{balance?: {amount?: string}}>(fetchFn, `${trimBase(restUrl)}/cosmos/bank/v1beta1/balances/${address}/by_denom?denom=${encodeURIComponent(denom)}`);
    return body?.balance?.amount ?? '0';
}

/** The dynamic fee module's current uphoton gas price, or undefined when it can't be read. */
export async function fetchDynamicGasPrice(restUrl: string, fetchFn: FetchFn = fetch): Promise<number | undefined> {
    try {
        const body = await getJson<{price?: {amount?: string}}>(fetchFn, `${trimBase(restUrl)}/cosmos/dynamicfee/v1/gas_price/${ATOMONE_FEE_DENOM}`);
        const price = parseFloat(body?.price?.amount ?? '');
        return Number.isFinite(price) && price > 0 ? price : undefined;
    } catch {
        return undefined;
    }
}

/** The account's sequence. Throws a readable error for an account the chain doesn't know yet. */
export async function fetchSequence(restUrl: string, address: string, fetchFn: FetchFn = fetch): Promise<bigint> {
    let body: {account?: AccountJson} | undefined;
    try {
        body = await getJson<{account?: AccountJson}>(fetchFn, `${trimBase(restUrl)}/cosmos/auth/v1beta1/accounts/${address}`);
    } catch (e) {
        throw new Error(`This account was not found on AtomOne (it needs a PHOTON balance first). ${(e as Error).message}`);
    }
    const acc: AccountJson = body?.account ?? {};
    const seq = acc.sequence ?? acc.base_account?.sequence ?? acc.base_vesting_account?.base_account?.sequence ?? '0';
    return BigInt(seq);
}

/** Simulates the tx on AtomOne and returns the gas it uses. Throws the chain's reason on failure. */
export async function simulateSetWithdrawAddress(
    restUrl: string,
    delegatorAddress: string,
    withdrawAddress: string,
    fetchFn: FetchFn = fetch,
): Promise<number> {
    const sequence = await fetchSequence(restUrl, delegatorAddress, fetchFn);
    const txBytes = buildSimulationTxBytes(delegatorAddress, withdrawAddress, sequence);
    const body = await getJson<{gas_info?: {gas_used?: string}}>(fetchFn, `${trimBase(restUrl)}/cosmos/tx/v1beta1/simulate`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({tx_bytes: toBase64(txBytes)}),
    });
    const gasUsed = Number(body?.gas_info?.gas_used ?? 0);
    if (!(gasUsed > 0)) {
        throw new Error('Gas simulation returned no gas');
    }
    return gasUsed;
}

/** Simulates and prices the tx: the fee to sign with. */
export async function estimateSetWithdrawAddressFee(
    restUrl: string,
    delegatorAddress: string,
    withdrawAddress: string,
    fetchFn: FetchFn = fetch,
): Promise<StdFee> {
    const [gasUsed, dynamicPrice] = await Promise.all([
        simulateSetWithdrawAddress(restUrl, delegatorAddress, withdrawAddress, fetchFn),
        fetchDynamicGasPrice(restUrl, fetchFn),
    ]);
    return computeAtomOneFee(gasUsed, effectiveGasPrice(dynamicPrice));
}

/** A base-unit amount as whole PHOTON for display. */
export function formatPhoton(amount: string): string {
    return new BigNumber(amount || '0').shiftedBy(-PHOTON_DECIMALS).toFormat();
}
