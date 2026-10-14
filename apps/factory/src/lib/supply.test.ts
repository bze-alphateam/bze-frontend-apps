import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import { BURN_OVER_BALANCE, newTotalSupply, shareOfSupply, supplyAmountError, supplyCoins } from "./supply";

describe("supplyAmountError", () => {
    it("uses the shared amount validation for both actions", () => {
        expect(supplyAmountError("", 6, "mint", new BigNumber(0))).toBe("Amount is required.");
        expect(supplyAmountError("abc", 6, "burn", new BigNumber(0))).toBe("Enter a valid positive number.");
        expect(supplyAmountError("0", 6, "mint", new BigNumber(0))).toBe("Amount must be greater than zero.");
        expect(supplyAmountError("1.1234567", 6, "mint", new BigNumber(0))).toMatch(/At most 6 decimal places/);
    });

    it("mint ignores the balance, burn is capped by it (base units)", () => {
        expect(supplyAmountError("5", 6, "mint", new BigNumber(0))).toBe("");
        expect(supplyAmountError("2", 6, "burn", new BigNumber(2_000_000))).toBe("");
        expect(supplyAmountError("2.000001", 6, "burn", new BigNumber(2_000_000))).toBe(BURN_OVER_BALANCE);
    });
});

describe("newTotalSupply", () => {
    it("adds a mint and subtracts a burn", () => {
        expect(newTotalSupply(new BigNumber("1000"), "250.5", "mint").toString()).toBe("1250.5");
        expect(newTotalSupply(new BigNumber("1000"), "250.5", "burn").toString()).toBe("749.5");
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
