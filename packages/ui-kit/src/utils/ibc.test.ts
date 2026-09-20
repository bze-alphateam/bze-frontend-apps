import {describe, it, expect} from "vitest";
import {ibcTransferTxOptions} from "./ibc";

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
});
