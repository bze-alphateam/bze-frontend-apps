import {describe, expect, it} from "vitest";
import BigNumber from "bignumber.js";
import {balanceToFormValue, isPositiveOrderValue} from "./trading-form";

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

// The market page's order guards used isPositive(), which is true for 0: a buy at price 0 matched
// no sell order and went to the chain as MsgCreateOrder with price "0".
describe("isPositiveOrderValue", () => {
    it("accepts values above zero", () => {
        expect(isPositiveOrderValue(new BigNumber("1"))).toBe(true);
        expect(isPositiveOrderValue(new BigNumber("0.000001"))).toBe(true);
    });

    it("rejects zero, where isPositive() would accept it", () => {
        expect(new BigNumber(0).isPositive()).toBe(true);
        expect(isPositiveOrderValue(new BigNumber(0))).toBe(false);
        expect(isPositiveOrderValue(new BigNumber("-0"))).toBe(false);
    });

    it("rejects negative and non-numeric values", () => {
        expect(isPositiveOrderValue(new BigNumber("-1"))).toBe(false);
        expect(isPositiveOrderValue(new BigNumber("."))).toBe(false);
        expect(isPositiveOrderValue(new BigNumber(Infinity))).toBe(false);
    });
});
