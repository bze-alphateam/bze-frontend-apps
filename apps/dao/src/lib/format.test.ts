import {describe, expect, it} from "vitest";
import {formatCoin, formatDay} from "./format";

describe("formatCoin", () => {
    it("shifts by the decimals and shows the ticker", () => {
        expect(formatCoin({denom: "ubze", amount: "1500000000"}, {decimals: 6, ticker: "BZE"})).toBe("1,500 BZE");
        expect(formatCoin({denom: "ubze", amount: "2500000"}, {decimals: 6, ticker: "BZE"})).toBe("2.5 BZE");
    });

    it("falls back to the raw amount and denom for an unknown asset", () => {
        expect(formatCoin({denom: "factory/bze1x/u", amount: "42"})).toBe("42 factory/bze1x/u");
    });
});

describe("formatDay", () => {
    it("formats an ISO time in UTC", () => {
        expect(formatDay("2026-11-01T23:30:00Z")).toBe("1 Nov 2026");
    });

    it("is empty for a missing or unreadable time", () => {
        expect(formatDay(null)).toBe("");
        expect(formatDay("soon")).toBe("");
    });
});
