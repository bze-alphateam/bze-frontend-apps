import { describe, it, expect, vi } from "vitest";
import { checkWithdrawAddress, withdrawTarget, type AddressValidation } from "./withdraw-address";

// A stand-in for ui-kit's bech32 check: "bze1…" is valid, other prefixes are another network.
const validate = vi.fn((address: string, prefix: string): AddressValidation => {
    const sep = address.toLowerCase().lastIndexOf("1");
    if (sep <= 0) {
        return { isValid: false, message: "Invalid address" };
    }
    const addressPrefix = address.toLowerCase().slice(0, sep);
    return addressPrefix === prefix
        ? { isValid: true, message: "" }
        : { isValid: false, message: `This address is from another network (${addressPrefix}).` };
});

const opts = { prefix: "bze", validate };

describe("checkWithdrawAddress", () => {
    it("treats an empty field as not ready, without an error message", () => {
        expect(checkWithdrawAddress("   ", opts)).toEqual({ ok: false, message: "" });
    });

    it("accepts a bze account address, trimmed", () => {
        expect(checkWithdrawAddress("  bze1new  ", opts)).toEqual({ ok: true, address: "bze1new" });
    });

    it("lower-cases an upper-case address", () => {
        expect(checkWithdrawAddress("BZE1NEW", opts)).toEqual({ ok: true, address: "bze1new" });
    });

    it("refuses a validator operator address", () => {
        const result = checkWithdrawAddress("bzevaloper1abc", opts);
        expect(result.ok).toBe(false);
        expect(result.ok === false && result.message).toMatch(/validator address/);
    });

    it("refuses another network's address with the validator's message", () => {
        expect(checkWithdrawAddress("cosmos1abc", opts)).toEqual({
            ok: false,
            message: "This address is from another network (cosmos).",
        });
    });

    it("refuses the address rewards already go to", () => {
        expect(checkWithdrawAddress("bze1same", { ...opts, current: "bze1same" })).toEqual({
            ok: false,
            message: "Rewards already go to this address.",
        });
    });

    it("allows resetting to the wallet itself when rewards go elsewhere", () => {
        expect(checkWithdrawAddress("bze1me", { ...opts, current: "bze1other" })).toEqual({ ok: true, address: "bze1me" });
    });
});

describe("withdrawTarget", () => {
    it("is self when rewards go to the wallet", () => {
        expect(withdrawTarget("bze1me", "bze1me")).toBe("self");
    });

    it("is other when rewards go to another address", () => {
        expect(withdrawTarget("bze1other", "bze1me")).toBe("other");
    });

    it("is unknown until both addresses are known", () => {
        expect(withdrawTarget(undefined, "bze1me")).toBe("unknown");
        expect(withdrawTarget("bze1me", undefined)).toBe("unknown");
    });
});
