import {describe, expect, it} from "vitest";
import BigNumber from "bignumber.js";
import {formatUsd, tokenBadge, treasuryView, type TreasuryCoinInfo} from "./dao-treasury";

const info = (prices: Record<string, number>): TreasuryCoinInfo => ({
    ticker: (denom) => denom.replace(/^u/, "").toUpperCase(),
    amount: (_denom, amount) => new BigNumber(amount).shiftedBy(-6).toFormat(),
    usdValue: (coin) => (coin.denom in prices ? new BigNumber(coin.amount).shiftedBy(-6).multipliedBy(prices[coin.denom]) : null),
});

describe("treasuryView", () => {
    it("one row per token with its amount and value, and the total", () => {
        const view = treasuryView([{denom: "uhoney", amount: "182400000000"}, {denom: "ubze", amount: "120000000000"}], info({uhoney: 0.05, ubze: 0.0395}));
        expect(view.rows.map((r) => [r.ticker, r.amount, r.usd])).toEqual([["HONEY", "182,400", "≈ $9,120"], ["BZE", "120,000", "≈ $4,740"]]);
        expect(view.total).toBe("≈ $13,860");
        expect(view.partial).toBe(false);
    });

    it("an unpriced token has no value and is left out of the total, which is then partial", () => {
        const view = treasuryView([{denom: "ubze", amount: "1000000000"}, {denom: "unew", amount: "5"}], info({ubze: 0.04}));
        expect(view.rows[1].usd).toBe("");
        expect(view.total).toBe("≈ $40.00");
        expect(view.partial).toBe(true);
    });

    it("no price at all: no total (never '≈ $0')", () => {
        const view = treasuryView([{denom: "unew", amount: "5"}], info({}));
        expect(view.total).toBe("");
        expect(view.partial).toBe(false);
        expect(treasuryView([], info({})).total).toBe("");
    });
});

describe("formatUsd", () => {
    it("whole dollars from 100 up, cents below", () => {
        expect(formatUsd(new BigNumber(14860.4))).toBe("≈ $14,860");
        expect(formatUsd(new BigNumber(12.5))).toBe("≈ $12.50");
    });
});

describe("tokenBadge", () => {
    it("the ticker's first letter; BZE (and the testnet's TBZE) always in its cyan; the same ticker the same colours", () => {
        expect(tokenBadge("HONEY").letter).toBe("H");
        expect(tokenBadge("BZE")).toMatchObject({letter: "B", from: "#33C3E0", to: "#0094C5"});
        expect(tokenBadge("TBZE")).toMatchObject({letter: "T", from: "#33C3E0"});
        expect(tokenBadge("usdc")).toEqual(tokenBadge("USDC"));
        expect(tokenBadge("…").letter).toBe("?");
    });
});
