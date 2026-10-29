import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import {
    DEFAULT_SLIPPAGE,
    MAX_SLIPPAGE,
    SLIPPAGE_PRESETS,
    isSlippagePreset,
    minimumSwapOutput,
    normalizeSlippage,
    parseCustomSlippage,
} from "./slippage";

describe("slippage presets", () => {
    it("offers 0.1% as the tightest preset and keeps the default among them", () => {
        expect(SLIPPAGE_PRESETS[0]).toBe(0.1);
        expect(isSlippagePreset(DEFAULT_SLIPPAGE)).toBe(true);
        expect(isSlippagePreset(0.3)).toBe(false);
    });
});

describe("normalizeSlippage", () => {
    it("keeps a stored value inside the accepted range", () => {
        expect(normalizeSlippage(0.1)).toBe(0.1);
        expect(normalizeSlippage(0)).toBe(0);
        expect(normalizeSlippage(MAX_SLIPPAGE)).toBe(MAX_SLIPPAGE);
        expect(normalizeSlippage(3.25)).toBe(3.25);
    });

    it("falls back to the default for anything missing, foreign or out of range", () => {
        expect(normalizeSlippage(undefined)).toBe(DEFAULT_SLIPPAGE);
        expect(normalizeSlippage(null)).toBe(DEFAULT_SLIPPAGE);
        expect(normalizeSlippage("1")).toBe(DEFAULT_SLIPPAGE);
        expect(normalizeSlippage(-1)).toBe(DEFAULT_SLIPPAGE);
        expect(normalizeSlippage(MAX_SLIPPAGE + 1)).toBe(DEFAULT_SLIPPAGE);
        expect(normalizeSlippage(NaN)).toBe(DEFAULT_SLIPPAGE);
        expect(normalizeSlippage(Infinity)).toBe(DEFAULT_SLIPPAGE);
    });
});

describe("parseCustomSlippage", () => {
    it("accepts percents from 0 to the cap", () => {
        expect(parseCustomSlippage("0.3")).toBe(0.3);
        expect(parseCustomSlippage("0")).toBe(0);
        expect(parseCustomSlippage("50")).toBe(50);
        expect(parseCustomSlippage(" 2 ")).toBe(2);
    });

    it("rejects empty, partial, negative, oversized and non-numeric text", () => {
        expect(parseCustomSlippage("")).toBeNull();
        expect(parseCustomSlippage(".")).toBeNull();
        expect(parseCustomSlippage("-1")).toBeNull();
        expect(parseCustomSlippage("51")).toBeNull();
        expect(parseCustomSlippage("abc")).toBeNull();
        expect(parseCustomSlippage("1e400")).toBeNull();
    });
});

describe("minimumSwapOutput", () => {
    it("takes the slippage off the quote and rounds down to whole micro units", () => {
        // 300.9 quoted means the chain pays 300; at 0.1 % the minimum must stay under 300.
        expect(minimumSwapOutput(new BigNumber("300.9"), 0.1)!.toFixed()).toBe("299");
        expect(minimumSwapOutput(new BigNumber(199360), 0.1)!.toFixed()).toBe("199160");
        expect(minimumSwapOutput(new BigNumber(1000), 0.5)!.toFixed()).toBe("995");
        expect(minimumSwapOutput(new BigNumber(999), 2)!.toFixed()).toBe("979");
    });

    it("sends exactly the chain's whole-unit output at 0 % slippage", () => {
        expect(minimumSwapOutput(new BigNumber("154909.8"), 0)!.toFixed()).toBe("154909");
        expect(minimumSwapOutput(new BigNumber(154909), 0)!.toFixed()).toBe("154909");
    });

    it("never goes below 1, which the chain rejects", () => {
        expect(minimumSwapOutput(new BigNumber(1), 2)!.toFixed()).toBe("1");
        expect(minimumSwapOutput(new BigNumber(40), 50)!.toFixed()).toBe("20");
    });

    it("is null when the quote rounds down to nothing", () => {
        expect(minimumSwapOutput(new BigNumber("0.4"), 0)).toBeNull();
        expect(minimumSwapOutput(new BigNumber(0), 0.5)).toBeNull();
        expect(minimumSwapOutput(new BigNumber(NaN), 0.5)).toBeNull();
    });
});
