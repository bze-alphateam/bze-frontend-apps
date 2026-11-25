import {describe, it, expect} from "vitest";
import {ibcTransferTxOptions, ibcVoucherDenom} from "./ibc";

// Regression guard: the direct-sign flag was dropped from the IBC hook once
// (the bzejs amino converter omits timeout_height, which the chain always
// emits) and every IBC transfer started failing with code 4. Amino must not
// be re-enabled here until the converter is fixed and verified on-chain.
describe("ibcTransferTxOptions", () => {
    it("forces direct signing for every IBC transfer, both directions", () => {
        expect(ibcTransferTxOptions(true).useDirectSign).toBe(true);
        expect(ibcTransferTxOptions(false).useDirectSign).toBe(true);
    });

    it("lets the wallet set the fee only on deposits, which sign on the foreign chain", () => {
        expect(ibcTransferTxOptions(true).letWalletSetFee).toBe(true);
        expect(ibcTransferTxOptions(false).letWalletSetFee).toBe(false);
    });

    // A refused withdrawal (rate limit, blocked denom, closed channel, paused message type) fails
    // in the simulation; signing anyway with the fallback fee would only burn the fee. A deposit
    // is signed on the foreign chain with no simulation, so there is nothing to abort on.
    it("aborts on a failed simulation for withdrawals only", () => {
        expect(ibcTransferTxOptions(false).abortOnSimulationError).toBe(true);
        expect(ibcTransferTxOptions(true).abortOnSimulationError).toBe(false);
    });
});

// Expected values are the vouchers chain-registry lists for BZE coins on Osmosis
// (BZE ↔ Osmosis is channel-0 ↔ channel-340).
describe("ibcVoucherDenom", () => {
    it("hashes the counterparty-side channel and the BZE denom", () => {
        expect(ibcVoucherDenom("channel-340", "ubze"))
            .toBe("ibc/C822645522FC3EECF817609AA38C24B64D04F5C267A23BCCF8F2E3BC5755FA88");
    });

    it("keeps the slashes of a factory denom in the hashed path", () => {
        expect(ibcVoucherDenom("channel-340", "factory/bze12gyp30f29zg26nuqrwdhl26ej4q066pt572fhm/GGE"))
            .toBe("ibc/AAC5DA36E48226B906DE694EA8B0464DE5EE45D7449984E4D799F33B8089CD6B");
    });
});
