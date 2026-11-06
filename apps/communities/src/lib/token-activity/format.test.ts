import {describe, expect, it} from "vitest";

import {formatCoin, formatCoins, formatUnits, formatWhen, shortAddress, shortHash} from "./format";

describe("formatUnits", () => {
    it("shows every significant decimal, grouped, without padding zeros", () => {
        expect(formatUnits("2294471843", 6)).toBe("2,294.471843");
        expect(formatUnits("5000000000", 6)).toBe("5,000");
        expect(formatUnits("3902", 6)).toBe("0.003902");
        expect(formatUnits("12", null)).toBe("12");
        expect(formatUnits("x", 6)).toBe("0");
    });
});

describe("formatCoin", () => {
    it("uses the symbol, else the denom in base units", () => {
        expect(formatCoin({denom: "ubze", amount: "930", symbol: "BZE", exponent: 6})).toBe("0.00093 BZE");
        expect(formatCoin({denom: "ibc/AB", amount: "930", symbol: null, exponent: null})).toBe("930 ibc/AB");
        expect(formatCoins([
            {denom: "ubze", amount: "1000000", symbol: "BZE", exponent: 6},
            {denom: "uvdl", amount: "2000000", symbol: "VDL", exponent: 6},
        ])).toBe("1 BZE + 2 VDL");
    });
});

describe("short forms", () => {
    it("shortens addresses and hashes as the canvas does", () => {
        expect(shortAddress("bze1fkj4ngtlqcxs83q360fl6f8jn8phzh4y6y3y5k")).toBe("bze1fk…y3y5k");
        expect(shortHash("8e56e5c0ac8a84ff0f0d6175ecc6784aaa74e2e285c4f644ee156100dbaef595")).toBe("8E56…F595");
        expect(shortAddress("bze1short")).toBe("bze1short");
    });
});

describe("formatWhen", () => {
    const now = new Date("2026-11-06T09:00:00Z");

    it("shows the day and the 24-hour time, the year only for another year", () => {
        expect(formatWhen("2026-11-05T21:09:16.590514Z", now, "UTC")).toBe("Nov 5 · 21:09");
        expect(formatWhen("2025-12-31T23:59:00Z", now, "UTC")).toBe("Dec 31, 2025 · 23:59");
        expect(formatWhen("not a time", now, "UTC")).toBe("");
    });
});
