import {describe, expect, it} from "vitest";
import {formatCoin, formatDateTime, formatDay, formatDuration, formatRatio, isoFromUnix, shortAddress} from "./format";

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

describe("DAO page formats", () => {
    it("formatDuration", () => {
        expect(formatDuration(259200)).toBe("3 days");
        expect(formatDuration(90000)).toBe("1 day 1 hour");
        expect(formatDuration(3600)).toBe("1 hour");
        expect(formatDuration(5400)).toBe("1 hour 30 minutes");
        expect(formatDuration(60)).toBe("1 minute");
        expect(formatDuration(0)).toBe("0 seconds");
    });

    it("formatRatio", () => {
        expect(formatRatio("0.400000000000000000")).toBe("40%");
        expect(formatRatio("0.3333")).toBe("33.33%");
        expect(formatRatio("0.333334")).toBe("33.34%");
        expect(formatRatio("0.999999")).toBe("just under 100%");
        expect(formatRatio("1")).toBe("100%");
        expect(formatRatio("nope")).toBe("nope");
    });

    it("isoFromUnix and formatDateTime", () => {
        expect(isoFromUnix("1790000000")).toBe("2026-09-21T14:13:20.000Z");
        expect(isoFromUnix("0")).toBeNull();
        expect(isoFromUnix("x")).toBeNull();
        expect(formatDateTime("2026-11-01T10:05:00Z")).toBe("1 Nov 2026, 10:05 UTC");
        expect(formatDateTime(null)).toBe("");
    });

    it("shortAddress", () => {
        expect(shortAddress("bze1short")).toBe("bze1short");
        expect(shortAddress("bze1qqqpkg3fxqmnu32v2ddxz6r0we7cfzuju395lw")).toBe("bze1qqqpkg…u395lw");
    });
});
