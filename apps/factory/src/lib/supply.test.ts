import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import { mintAmountError, newTotalSupply, shareOfSupply, supplyCoins } from "./supply";

describe("mintAmountError", () => {
    it("uses the shared amount validation", () => {
        expect(mintAmountError("", 6)).toBe("Amount is required.");
        expect(mintAmountError("abc", 6)).toBe("Enter a valid positive number.");
        expect(mintAmountError("0", 6)).toBe("Amount must be greater than zero.");
        expect(mintAmountError("1.1234567", 6)).toMatch(/At most 6 decimal places/);
        expect(mintAmountError("5", 6)).toBe("");
    });
});

describe("newTotalSupply", () => {
    it("adds the minted amount", () => {
        expect(newTotalSupply(new BigNumber("1000"), "250.5").toString()).toBe("1250.5");
    });
});

describe("supplyCoins", () => {
    it("writes the amount in base units next to the denom", () => {
        expect(supplyCoins("1.5", 6, "factory/bze1x/utok")).toBe("1500000factory/bze1x/utok");
        expect(supplyCoins(" 3 ", 0, "utok")).toBe("3utok");
    });
});

describe("shareOfSupply", () => {
    it("formats the share and skips a zero supply", () => {
        expect(shareOfSupply(new BigNumber(25), new BigNumber(200))).toBe("12.5% of supply");
        expect(shareOfSupply(new BigNumber(1), new BigNumber(1_000_000))).toBe("<0.01% of supply");
        expect(shareOfSupply(new BigNumber(0), new BigNumber(10))).toBe("0% of supply");
        expect(shareOfSupply(new BigNumber(1), new BigNumber(0))).toBeUndefined();
    });
});
