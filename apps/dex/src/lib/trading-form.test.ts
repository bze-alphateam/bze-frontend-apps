import {describe, expect, it} from "vitest";
import BigNumber from "bignumber.js";
import {getMinAmount} from "@bze/bze-ui-kit";
import {balanceToFormValue, isPositiveOrderValue, orderPriceSent} from "./trading-form";

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

describe("orderPriceSent", () => {
    it("is the user's price for a fresh order or a multi-order fill", () => {
        expect(orderPriceSent(new BigNumber("0.03"), []).toFixed()).toBe("0.03");
        expect(orderPriceSent(new BigNumber("0.03"), ["0.02", "0.025"]).toFixed()).toBe("0.03");
    });

    it("is the matched order's price when exactly one order is filled", () => {
        // A buy at 0.03 against a single sell at 0.02 is sent at 0.02, where the chain's minimum
        // (ceil(1 / price) * 2) is 100 base units instead of 68: 80 passes at 0.03 but not at 0.02.
        const sent = orderPriceSent(new BigNumber("0.03"), ["0.02"]);
        expect(sent.toFixed()).toBe("0.02");
        expect(getMinAmount(sent).toFixed()).toBe("100");
        expect(getMinAmount("0.03").toFixed()).toBe("68");
        expect(new BigNumber(80).lt(getMinAmount(sent))).toBe(true);
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
