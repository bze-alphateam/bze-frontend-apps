import {describe, expect, it} from "vitest";
import BigNumber from "bignumber.js";
import {buildFillEntries, hasOrderAtPrice, maxFillsReachedMessage} from "./order-fills";

describe("buildFillEntries", () => {
    it("writes amounts without exponent notation at 1e21 and above", () => {
        const entries = buildFillEntries([{price: "2", amount: "1000000000000000000000"}]);

        expect(entries).toEqual([{price: "2", amount: "1000000000000000000000"}]);
    });

    it("normalises chain amounts written with decimals", () => {
        expect(buildFillEntries([{price: "2", amount: "150.000"}])[0].amount).toBe("150");
    });

    it("merges entries at the same price written differently", () => {
        const entries = buildFillEntries([
            {price: "1", amount: "10"},
            {price: "1.000000000000000000", amount: "5"},
            {price: "1.5", amount: "7"},
        ]);

        expect(entries).toEqual([{price: "1", amount: "15"}, {price: "1.5", amount: "7"}]);
    });
});

describe("hasOrderAtPrice", () => {
    const mine = [{order_type: "buy", price: "1.500000000000000000"}];

    it("matches the same side and a numerically equal price", () => {
        expect(hasOrderAtPrice(mine, "buy", new BigNumber("1.5"))).toBe(true);
    });

    it("ignores the other side and other prices", () => {
        expect(hasOrderAtPrice(mine, "sell", new BigNumber("1.5"))).toBe(false);
        expect(hasOrderAtPrice(mine, "buy", new BigNumber("1.6"))).toBe(false);
        expect(hasOrderAtPrice(mine, "buy", new BigNumber(NaN))).toBe(false);
    });
});

describe("maxFillsReachedMessage", () => {
    it("names the cap", () => {
        expect(maxFillsReachedMessage(500)).toContain("at most 500 resting orders");
    });
});
