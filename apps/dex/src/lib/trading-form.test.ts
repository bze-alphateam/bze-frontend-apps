import {describe, expect, it} from "vitest";
import BigNumber from "bignumber.js";
import {balanceToFormValue} from "./trading-form";

describe("balanceToFormValue", () => {
    it("converts a micro amount to its display amount", () => {
        expect(balanceToFormValue(new BigNumber("1500000"), 6)).toBe("1.5");
    });

    it("accepts string and number micro amounts", () => {
        expect(balanceToFormValue("2500000", 6)).toBe("2.5");
        expect(balanceToFormValue(2500000, 6)).toBe("2.5");
    });

    it("returns a plain number without thousand separators", () => {
        expect(balanceToFormValue("1234567000000", 6)).toBe("1234567");
    });

    it("never returns exponential notation for tiny balances", () => {
        expect(balanceToFormValue("1", 8)).toBe("0.00000001");
    });

    it("handles assets declaring zero decimals", () => {
        expect(balanceToFormValue("42", 0)).toBe("42");
    });

    it("returns an empty string when there is no balance to fill", () => {
        expect(balanceToFormValue(undefined, 6)).toBe("");
        expect(balanceToFormValue("", 6)).toBe("");
        expect(balanceToFormValue(new BigNumber(0), 6)).toBe("");
        expect(balanceToFormValue("not-a-number", 6)).toBe("");
    });
});
