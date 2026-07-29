import { describe, it, expect } from "vitest";

import { rafflePrize, raffleWinChance } from "./raffle";

describe("rafflePrize", () => {
    it("scales the pot (uamount) by the payout ratio", () => {
        // pot 1_000_000 uamount @ 6 decimals = 1.0; * ratio 0.5 = 0.5
        expect(rafflePrize("1000000", "0.5", 6)).toBe("0.500000");
    });

    it("returns the whole pot when the ratio is 1", () => {
        // 2_000_000 @ 6 decimals = 2.0
        expect(rafflePrize("2000000", "1", 6)).toBe("2");
    });

    it("honours the token's decimals", () => {
        // 5000 uamount @ 3 decimals = 5.0 (would be 0.005 at 6 decimals)
        expect(rafflePrize("5000", "1", 3)).toBe("5");
    });
});

describe("raffleWinChance", () => {
    it("expresses chances-per-million as a 1 in N ratio", () => {
        // 1000 chances / 1,000,000 -> odds of 1 in 1,000
        expect(raffleWinChance("1000")).toBe("1 in 1,000");
    });

    it("handles a single chance in a million", () => {
        expect(raffleWinChance("1")).toBe("1 in 1,000,000");
    });

    it("handles a large chance count (better odds)", () => {
        // 500,000 / 1,000,000 -> 1 in 2
        expect(raffleWinChance("500000")).toBe("1 in 2");
    });

    it("returns N/A for negative or unparseable chances", () => {
        expect(raffleWinChance("-5")).toBe("N/A");
        expect(raffleWinChance("not-a-number")).toBe("N/A");
    });

    it("carries over the original zero-chances behaviour verbatim", () => {
        // Pre-existing quirk: BigNumber(0).isPositive() is true, so the original
        // guard never caught chances === 0; it divides by zero and renders
        // "1 in ∞". Preserved here (extraction is behaviour-neutral) and flagged
        // to Stefan as a separate, out-of-scope display fix.
        expect(raffleWinChance("0")).toBe("1 in ∞");
    });
});
