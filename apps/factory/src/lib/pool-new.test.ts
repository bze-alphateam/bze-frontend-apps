import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import { maxReserveAmount, sortPairForChain, swapFeeSummary, swapFeeToChain, validateSwapFee } from "./pool-new";

describe("validateSwapFee", () => {
    it.each([
        ["0.09", "Swap fee must be between 0.1% and 5%."],
        ["0.1", ""],
        ["0.2", ""],
        ["5", ""],
        ["5.01", "Swap fee must be between 0.1% and 5%."],
        ["0.123", "At most 2 decimal places."],
        ["  ", "Swap fee is required."],
        ["1e-1", "Enter a valid percentage."],
    ])("%j → %j", (fee, error) => {
        expect(validateSwapFee(fee)).toBe(error);
    });

    it("sends the percentage as a fraction", () => {
        expect(swapFeeToChain("0.2")).toBe("0.002");
        expect(swapFeeToChain("5")).toBe("0.05");
    });
});

describe("sortPairForChain", () => {
    it("keeps an alphabetical pair as it is", () => {
        expect(sortPairForChain("ubze", "utok", "1", "2")).toEqual({ base: "ubze", quote: "utok", initialBase: "1", initialQuote: "2" });
    });

    it("swaps the denoms and the amounts of a reversed pair", () => {
        expect(sortPairForChain("utok", "ubze", "1", "2")).toEqual({ base: "ubze", quote: "utok", initialBase: "2", initialQuote: "1" });
    });
});

describe("maxReserveAmount", () => {
    const fee = { denom: "ubze", amount: "25000000" };

    it("leaves the creation fee in the fee denom", () => {
        expect(maxReserveAmount(new BigNumber("100000000"), "ubze", fee).toFixed()).toBe("75000000");
    });

    it("floors at zero", () => {
        expect(maxReserveAmount(new BigNumber("1000"), "ubze", fee).toFixed()).toBe("0");
    });

    it("takes everything spendable in another denom, or when the fee is unknown", () => {
        expect(maxReserveAmount(new BigNumber("100"), "utok", fee).toFixed()).toBe("100");
        expect(maxReserveAmount(new BigNumber("100"), "ubze").toFixed()).toBe("100");
    });
});

it("summarises the fee and the split", () => {
    expect(swapFeeSummary(" 0.3 ", { providers: 50, burner: 30, treasury: 20 })).toBe("0.3% · providers 50% · burner 30% · treasury 20%");
});
