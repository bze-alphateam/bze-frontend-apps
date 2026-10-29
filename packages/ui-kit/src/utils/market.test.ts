import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import { getMinAmount } from "./market";

// Mirrors the chain's tradebin `CalculateMinAmount`: ceil(1 / price) * 2, in micro base units.
describe("getMinAmount", () => {
    it("returns the chain's minimum in micro units: ceil(1 / uPrice) * 2", () => {
        expect(getMinAmount("0.02").toFixed()).toBe("100");
        expect(getMinAmount("3").toFixed()).toBe("2");
        expect(getMinAmount("0.3").toFixed()).toBe("8");
        expect(getMinAmount("1").toFixed()).toBe("2");
        expect(getMinAmount("2.5").toFixed()).toBe("2");
        expect(getMinAmount("0.000001").toFixed()).toBe("2000000");
        expect(getMinAmount(new BigNumber("0.5")).toFixed()).toBe("4");
    });

    it("is a whole number of micro units, never a display amount", () => {
        const min = getMinAmount("0.02");
        expect(min.isInteger()).toBe(true);
        // A 10 ubze order at this price must fail the check the chain applies (minimum 100 ubze).
        expect(new BigNumber(10).lt(min)).toBe(true);
    });

    it("is zero for a price that is not positive", () => {
        expect(getMinAmount("0").toFixed()).toBe("0");
        expect(getMinAmount("-1").toFixed()).toBe("0");
        expect(getMinAmount("abc").toFixed()).toBe("0");
    });
});
