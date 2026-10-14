import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import { minLpTokens, oppositeDeposit, shareAfterDeposit } from "./pool-add";

// 3 base per 1 quote; base has 6 decimals, quote 2.
const pool = { reserve_base: "3000000", reserve_quote: "100" };

describe("oppositeDeposit", () => {
    it("fills the quote from a base amount, rounding up", () => {
        // 1 base = 1,000,000 micro → 33.33… quote micro → 34 → 0.34
        expect(oppositeDeposit(pool, "1", true, 6, 2)).toBe("0.34");
    });

    it("fills the base from a quote amount, rounding up", () => {
        // 0.01 quote = 1 micro → 30,000 base micro exactly
        expect(oppositeDeposit(pool, "0.01", false, 2, 6)).toBe("0.03");
        // 2 reserves that do not divide evenly: 1 quote micro → 3,000,000/7 base micro
        expect(oppositeDeposit({ reserve_base: "3000000", reserve_quote: "7" }, "0.01", false, 2, 6)).toBe("0.428572");
    });

    it("is empty for an invalid amount or a zero result", () => {
        expect(oppositeDeposit(pool, "", true, 6, 2)).toBe("");
        expect(oppositeDeposit(pool, "abc", true, 6, 2)).toBe("");
        expect(oppositeDeposit({ reserve_base: "0", reserve_quote: "0" }, "1", true, 6, 2)).toBe("");
    });
});

describe("minLpTokens", () => {
    it("floors expected × (100 − slippage) / 100", () => {
        expect(minLpTokens(new BigNumber(1000), "1").toFixed()).toBe("990");
        expect(minLpTokens(new BigNumber(1999), "0.5").toFixed()).toBe("1989");
        expect(minLpTokens(new BigNumber(10), "3").toFixed()).toBe("9");
    });

    it("never goes below 1 when something is expected", () => {
        expect(minLpTokens(new BigNumber(1), "3").toFixed()).toBe("1");
    });

    it("is 0 when nothing is expected", () => {
        expect(minLpTokens(new BigNumber(0), "1").toFixed()).toBe("0");
    });
});

describe("shareAfterDeposit", () => {
    it("adds the new LP tokens to both the wallet's and the pool's shares", () => {
        expect(shareAfterDeposit(new BigNumber(100), new BigNumber(100), new BigNumber(800))?.toFixed(2)).toBe("22.22");
        expect(shareAfterDeposit(new BigNumber(100), new BigNumber(0), new BigNumber(0))?.toFixed(2)).toBe("100.00");
    });

    it("is undefined without a deposit", () => {
        expect(shareAfterDeposit(new BigNumber(0), new BigNumber(1), new BigNumber(2))).toBeUndefined();
    });
});
