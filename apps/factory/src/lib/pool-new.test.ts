import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import type { Asset } from "@bze/bze-ui-kit";
import { createPoolMsgValue, maxReserveAmount, pairProblem, sortPairForChain, startingPrice, swapFeeSummary, swapFeeToChain, validateSwapFee } from "./pool-new";

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

describe("swapFeeSummary", () => {
    it("names each share of the split", () => {
        expect(swapFeeSummary(" 0.2 ", { providers: 50, burner: 25, treasury: 25 })).toBe("0.2% · 50% to providers, 25% burned, 25% treasury");
    });

    it("leaves out the shares at 0 %", () => {
        expect(swapFeeSummary("1", { providers: 100, burner: 0, treasury: 0 })).toBe("1% · 100% to providers");
        expect(swapFeeSummary("0.3", { providers: 0, burner: 60, treasury: 40 })).toBe("0.3% · 60% burned, 40% treasury");
    });
});

describe("pairProblem", () => {
    const tok = { denom: "utok", ticker: "TOK" } as Asset;
    const bze = { denom: "ubze", ticker: "BZE" } as Asset;
    const halted = { denom: "uhalt", ticker: "HALT", halted: true } as Asset;
    const noPool = () => undefined;

    it("waits for both sides", () => {
        expect(pairProblem("utok", "", tok, undefined, noPool)).toBeUndefined();
    });

    it("rejects the same token twice", () => {
        expect(pairProblem("ubze", "ubze", bze, bze, noPool)).toEqual({ message: "Pick two different tokens." });
    });

    it("rejects a halted token", () => {
        expect(pairProblem("uhalt", "ubze", halted, bze, noPool)?.message).toMatch(/^HALT is no longer tradeable on BZE/);
    });

    it("names the existing pool of the pair, in either order", () => {
        const findPool = (a: string, b: string) => ([a, b].sort().join("_") === "ubze_utok" ? { id: "ubze_utok" } : undefined);
        expect(pairProblem("utok", "ubze", tok, bze, findPool)).toEqual({
            message: "This pair already has a pool. Each pair gets exactly one.",
            existingPoolId: "ubze_utok",
        });
    });

    it("passes a new pair", () => {
        expect(pairProblem("utok", "ubze", tok, bze, noPool)).toBeUndefined();
    });
});

describe("startingPrice", () => {
    it("is the quote per base", () => {
        expect(startingPrice("100000", "200")?.toFixed()).toBe("0.002");
        expect(startingPrice(" 4 ", "10")?.toFixed()).toBe("2.5");
    });

    it.each([["", "1"], ["1", ""], ["0", "1"], ["1", "0"], ["abc", "1"], ["-1", "1"]])("is undefined for %j and %j", (base, quote) => {
        expect(startingPrice(base, quote)).toBeUndefined();
    });
});

describe("createPoolMsgValue", () => {
    it("sorts the pair with its amounts, sends the fee as a fraction, the split as feeDest and stable false", () => {
        expect(createPoolMsgValue({
            creator: "bze1me", baseDenom: "utok", quoteDenom: "ubze", baseUAmount: "1000", quoteUAmount: "2",
            swapFeePct: "0.3", split: { providers: 50, burner: 25, treasury: 25 },
        })).toEqual({
            creator: "bze1me",
            base: "ubze",
            quote: "utok",
            initialBase: "2",
            initialQuote: "1000",
            fee: "0.003",
            feeDest: JSON.stringify({ providers: "0.50", burner: "0.25", treasury: "0.25" }),
            stable: false,
        });
    });
});
