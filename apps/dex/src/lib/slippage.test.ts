import { describe, it, expect } from "vitest";
import {
    DEFAULT_SLIPPAGE,
    MAX_SLIPPAGE,
    SLIPPAGE_PRESETS,
    isSlippagePreset,
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
