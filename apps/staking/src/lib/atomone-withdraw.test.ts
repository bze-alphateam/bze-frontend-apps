import {describe, it, expect, vi} from 'vitest';
import {Tx} from '@bze/bzejs/cosmos/tx/v1beta1/tx';
import {MsgSetWithdrawAddress} from '@bze/bzejs/cosmos/distribution/v1beta1/tx';
import {
    ATOMONE_FEE_DENOM,
    ATOMONE_MIN_GAS_PRICE,
    buildSetWithdrawAddressMsg,
    buildSimulationTxBytes,
    computeAtomOneFee,
    effectiveGasPrice,
    estimateSetWithdrawAddressFee,
    explorerTxUrl,
    fetchBalance,
    fetchDynamicGasPrice,
    fetchSequence,
    fetchWithdrawAddress,
    formatPhoton,
    SET_WITHDRAW_ADDRESS_TYPE_URL,
    toBase64,
    type FetchFn,
} from './atomone-withdraw';

const REST = 'https://rest.example/';
const DELEGATOR = 'atone1delegator';
const TARGET = 'atone1target';

const json = (body: unknown, status = 200) =>
    Promise.resolve({ok: status >= 200 && status < 300, status, json: async () => body} as unknown as Response);

/** A fetch answering by URL suffix. */
function fakeFetch(routes: Record<string, () => Promise<Response>>) {
    return vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const key = Object.keys(routes).find(k => url.includes(k));
        if (!key) throw new Error(`unexpected ${url}`);
        return routes[key]();
    }) as unknown as FetchFn & ReturnType<typeof vi.fn>;
}

describe('fee maths', () => {
    it('never prices below the static minimum', () => {
        expect(effectiveGasPrice(0.01)).toBe(ATOMONE_MIN_GAS_PRICE);
        expect(effectiveGasPrice(undefined)).toBe(ATOMONE_MIN_GAS_PRICE);
        expect(effectiveGasPrice(NaN)).toBe(ATOMONE_MIN_GAS_PRICE);
        expect(effectiveGasPrice(0.5)).toBe(0.5);
    });

    it('rounds gas and amount up, in uphoton', () => {
        expect(computeAtomOneFee(100_001, 0.225, 1.3)).toEqual({
            amount: [{denom: 'uphoton', amount: '29251'}],
            gas: '130002',
        });
    });

    it('refuses a zero simulation', () => {
        expect(() => computeAtomOneFee(0, 0.225)).toThrow();
    });
});

describe('messages and bytes', () => {
    it('builds the distribution message', () => {
        const msg = buildSetWithdrawAddressMsg(DELEGATOR, TARGET);
        expect(msg.typeUrl).toBe(SET_WITHDRAW_ADDRESS_TYPE_URL);
        expect(msg.value).toMatchObject({delegatorAddress: DELEGATOR, withdrawAddress: TARGET});
    });

    it('encodes a simulation tx with the sequence and a 1 uphoton fee', () => {
        const tx = Tx.decode(buildSimulationTxBytes(DELEGATOR, TARGET, BigInt(7)));
        expect(tx.authInfo?.signerInfos[0].sequence).toBe(BigInt(7));
        expect(tx.authInfo?.fee?.amount).toEqual([{denom: ATOMONE_FEE_DENOM, amount: '1'}]);
        const any = tx.body!.messages[0];
        expect(any.typeUrl).toBe(SET_WITHDRAW_ADDRESS_TYPE_URL);
        expect(MsgSetWithdrawAddress.decode(any.value)).toMatchObject({delegatorAddress: DELEGATOR, withdrawAddress: TARGET});
    });

    it('base64-encodes bytes', () => {
        expect(toBase64(new Uint8Array([104, 105]))).toBe('aGk=');
    });

    it('fills the explorer template', () => {
        expect(explorerTxUrl('ABC', 'https://x/tx/${txHash}')).toBe('https://x/tx/ABC');
        expect(explorerTxUrl('ABC')).toContain('/tx/ABC');
    });

    it('formats PHOTON', () => {
        expect(formatPhoton('1500000')).toBe('1.5');
        expect(formatPhoton('')).toBe('0');
    });
});

describe('REST queries', () => {
    it('reads the withdraw address', async () => {
        const f = fakeFetch({'/withdraw_address': () => json({withdraw_address: TARGET})});
        await expect(fetchWithdrawAddress(REST, DELEGATOR, f)).resolves.toBe(TARGET);
        expect(String(f.mock.calls[0][0])).toBe(`https://rest.example/cosmos/distribution/v1beta1/delegators/${DELEGATOR}/withdraw_address`);
    });

    it('surfaces REST errors', async () => {
        const f = fakeFetch({'/withdraw_address': () => json({message: 'boom'}, 500)});
        await expect(fetchWithdrawAddress(REST, DELEGATOR, f)).rejects.toThrow('boom');
    });

    it('reads a balance, 0 when missing', async () => {
        await expect(fetchBalance(REST, DELEGATOR, 'uphoton', fakeFetch({'by_denom': () => json({balance: {denom: 'uphoton', amount: '42'}})}))).resolves.toBe('42');
        await expect(fetchBalance(REST, DELEGATOR, 'uphoton', fakeFetch({'by_denom': () => json({})}))).resolves.toBe('0');
    });

    it('reads the dynamic gas price, undefined on failure', async () => {
        await expect(fetchDynamicGasPrice(REST, fakeFetch({'gas_price': () => json({price: {denom: 'uphoton', amount: '0.3'}})}))).resolves.toBe(0.3);
        await expect(fetchDynamicGasPrice(REST, fakeFetch({'gas_price': () => json({}, 501)}))).resolves.toBeUndefined();
    });

    it('reads the sequence of plain and vesting accounts', async () => {
        await expect(fetchSequence(REST, DELEGATOR, fakeFetch({'/accounts/': () => json({account: {sequence: '5'}})}))).resolves.toBe(BigInt(5));
        await expect(fetchSequence(REST, DELEGATOR, fakeFetch({'/accounts/': () => json({account: {base_vesting_account: {base_account: {sequence: '9'}}}})}))).resolves.toBe(BigInt(9));
        await expect(fetchSequence(REST, DELEGATOR, fakeFetch({'/accounts/': () => json({message: 'not found'}, 404)}))).rejects.toThrow('not found on AtomOne');
    });

    it('simulates and prices the tx', async () => {
        const f = fakeFetch({
            '/accounts/': () => json({account: {sequence: '1'}}),
            '/simulate': () => json({gas_info: {gas_used: '100000'}}),
            'gas_price': () => json({price: {denom: 'uphoton', amount: '0.01'}}),
        });
        await expect(estimateSetWithdrawAddressFee(REST, DELEGATOR, TARGET, f)).resolves.toEqual({
            amount: [{denom: 'uphoton', amount: '29250'}],
            gas: '130000',
        });
        const simCall = f.mock.calls.find(c => String(c[0]).endsWith('/simulate'))!;
        expect(simCall[1]).toMatchObject({method: 'POST'});
        expect(JSON.parse((simCall[1] as RequestInit).body as string)).toHaveProperty('tx_bytes');
    });

    it('passes the simulation error through', async () => {
        const f = fakeFetch({
            '/accounts/': () => json({account: {sequence: '1'}}),
            '/simulate': () => json({message: 'insufficient funds'}, 400),
            'gas_price': () => json({}, 501),
        });
        await expect(estimateSetWithdrawAddressFee(REST, DELEGATOR, TARGET, f)).rejects.toThrow('insufficient funds');
    });
});
