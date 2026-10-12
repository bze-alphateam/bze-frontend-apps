import {describe, expect, it} from "vitest";
import BigNumber from "bignumber.js";
import type {LiquidityPoolSDKType} from "@bze/bzejs/bze/tradebin/store";
import type {LiquidityPoolData} from "@bze/bze-ui-kit";

import {
    addLiquidityMessage,
    depositAmountProblem,
    depositShares,
    matchedAmount,
    poolShareOf,
    removeEstimate,
    removeLiquidityMessage,
    shareAfterDeposit,
    tokenPoolRows,
} from "./liquidity";

const T = "factory/bze1owner/upage";
const ABC = "factory/bze1abc/uabc";

const pool = (base: string, quote: string, reserveBase: string, reserveQuote: string): LiquidityPoolSDKType => ({
    id: `${base}_${quote}`, base, quote, lp_denom: `ulp_${base}_${quote}`, creator: "bze1creator",
    fee: "0.003", fee_dest: {treasury: "0", burner: "0", providers: "1", liquidity: "0"},
    reserve_base: reserveBase, reserve_quote: reserveQuote, stable: false,
});

// 1,000 PAGE against 4,000 BZE: 1 PAGE = 4 BZE; 1,000,000,000 LP shares in all.
const PAGE_BZE = pool(T, "ubze", "1000000000", "4000000000");
const TOTAL = new BigNumber("1000000000");

const stats = (id: string, usdValue: number, usdVolume: number, apr: string, isComplete = true): LiquidityPoolData => ({
    poolId: id, base: "", quote: "", usdValue: new BigNumber(usdValue), usdVolume: new BigNumber(usdVolume),
    usdFees: new BigNumber(0), isComplete, apr, baseVolume: new BigNumber(0), quoteVolume: new BigNumber(0),
});

describe("tokenPoolRows", () => {
    const usdc = pool(T, "uusdc", "1", "1");
    const abc = pool(ABC, T, "1", "1");
    const other = pool("ubze", "uusdc", "1", "1");
    const data = new Map([
        [PAGE_BZE.id, stats(PAGE_BZE.id, 500, 0, "0.00")],
        [usdc.id, stats(usdc.id, 9000, 1200, "12.50")],
        [abc.id, stats(abc.id, 20000, 300, "4.00", false)],
        [other.id, stats(other.id, 1e9, 1e6, "99.00")],
    ]);

    it("lists only the pools containing T, the most liquidity first, with the other token", () => {
        const rows = tokenPoolRows(T, [PAGE_BZE, other, abc, usdc], data);

        expect(rows.map((row) => row.pool.id)).toEqual([abc.id, usdc.id, PAGE_BZE.id]);
        expect(rows.map((row) => [row.other, row.tokenIsBase])).toEqual([[ABC, false], ["uusdc", true], ["ubze", true]]);
    });

    it("shows the liquidity only when both tokens are priced", () => {
        const [half, full] = tokenPoolRows(T, [abc, usdc], data);

        expect(half.liquidityUsd).toBeUndefined();
        expect(full.liquidityUsd?.toNumber()).toBe(9000);
    });

    it("hides the APR without volume, and every number without pool data", () => {
        const rows = tokenPoolRows(T, [usdc, PAGE_BZE], data);
        expect(rows[0].apr?.toNumber()).toBe(12.5);
        expect(rows[1].apr).toBeUndefined();
        expect(rows[1].volumeUsd?.toNumber()).toBe(0);

        const [bare] = tokenPoolRows(T, [PAGE_BZE], new Map());
        expect([bare.liquidityUsd, bare.volumeUsd, bare.apr]).toEqual([undefined, undefined, undefined]);
    });

    it("hides an APR that isn't a positive number", () => {
        const odd = new Map([[usdc.id, stats(usdc.id, 1, 5, "NaN")]]);

        expect(tokenPoolRows(T, [usdc], odd)[0].apr).toBeUndefined();
    });
});

describe("matchedAmount", () => {
    it("keeps the pool's ratio both ways", () => {
        expect(matchedAmount(PAGE_BZE, "10", true, 6, 6).toFixed()).toBe("40");
        expect(matchedAmount(PAGE_BZE, "40", false, 6, 6).toFixed()).toBe("10");
    });

    it("rounds down to the other token's decimals", () => {
        // 0.0000013 BZE is 1 ubze (the input is cut to 6 decimals): 0.25 upage, rounded down to 0.
        expect(matchedAmount(PAGE_BZE, "0.0000013", false, 6, 6).toFixed()).toBe("0");
        // 1 upage pairs with 4 ubze.
        expect(matchedAmount(PAGE_BZE, "0.000001", true, 6, 6).toFixed()).toBe("0.000004");
        // The base units are shifted by the other token's decimals: 4 units of an 8-decimal token.
        expect(matchedAmount(PAGE_BZE, "0.000001", true, 6, 8).toFixed()).toBe("0.00000004");
    });

    it("is 0 for an empty or invalid amount and for an empty pool", () => {
        expect(matchedAmount(PAGE_BZE, "", true, 6, 6).toFixed()).toBe("0");
        expect(matchedAmount(PAGE_BZE, "abc", true, 6, 6).toFixed()).toBe("0");
        expect(matchedAmount(pool(T, "ubze", "0", "0"), "5", true, 6, 6).toFixed()).toBe("0");
    });
});

describe("depositShares", () => {
    it("mints the smaller deposit ratio of the LP supply, rounded down", () => {
        // 10 PAGE + 40 BZE is 1% of each reserve.
        expect(depositShares(PAGE_BZE, TOTAL, new BigNumber(10e6), new BigNumber(40e6)).toFixed()).toBe("10000000");
        // Extra BZE adds nothing: the PAGE side limits it.
        expect(depositShares(PAGE_BZE, TOTAL, new BigNumber(10e6), new BigNumber(80e6)).toFixed()).toBe("10000000");
        // 3 upage of 1e9 is 3e-9 of 1e9 shares = 3; 7 ubze of 4e9 is 1.75 shares → the lower, 1.
        expect(depositShares(PAGE_BZE, TOTAL, new BigNumber(3), new BigNumber(7)).toFixed()).toBe("1");
    });

    it("is 0 with nothing deposited or nothing in the pool", () => {
        expect(depositShares(PAGE_BZE, TOTAL, new BigNumber(0), new BigNumber(40e6)).toFixed()).toBe("0");
        expect(depositShares(PAGE_BZE, 0, new BigNumber(10e6), new BigNumber(40e6)).toFixed()).toBe("0");
        expect(depositShares(pool(T, "ubze", "0", "5"), TOTAL, new BigNumber(1), new BigNumber(1)).toFixed()).toBe("0");
    });
});

describe("shares of the pool", () => {
    it("counts the new shares in the supply after a deposit", () => {
        expect(shareAfterDeposit(new BigNumber(10e6), TOTAL).toFixed(4)).toBe("0.9901");
        expect(shareAfterDeposit(new BigNumber(0), 0).toFixed()).toBe("0");
    });

    it("is undefined for a viewer without shares", () => {
        expect(poolShareOf(new BigNumber(25e6), TOTAL)?.toFixed()).toBe("2.5");
        expect(poolShareOf(new BigNumber(0), TOTAL)).toBeUndefined();
        expect(poolShareOf(new BigNumber(5), 0)).toBeUndefined();
    });
});

describe("depositAmountProblem", () => {
    const balance = new BigNumber(100);

    it("names what's wrong with the amount", () => {
        expect(depositAmountProblem("0", balance, 6, "PAGE")).toBe("Enter an amount of PAGE above 0");
        expect(depositAmountProblem("1.0000001", balance, 6, "PAGE")).toBe("Use at most 6 decimals for PAGE");
        expect(depositAmountProblem("100.5", balance, 6, "PAGE")).toBe("Insufficient PAGE balance");
    });

    it("accepts the whole balance", () => {
        expect(depositAmountProblem("100", balance, 6, "PAGE")).toBe("");
    });
});

describe("removeEstimate", () => {
    const mine = new BigNumber(100_000_001);

    it("removes a rounded-down part of the shares and what they return, rounded down", () => {
        const half = removeEstimate(PAGE_BZE, mine, TOTAL, 50);

        expect(half.lpTokens.toFixed()).toBe("50000000");
        expect(half.base.toFixed()).toBe("50000000");
        expect(half.quote.toFixed()).toBe("200000000");

        const quarter = removeEstimate(pool(T, "ubze", "999", "1001"), new BigNumber(3), 10, 75);
        // 75% of 3 shares is 2 (2.25 down); 2/10 of 999 and 1001 is 199.8 and 200.2.
        expect([quarter.lpTokens, quarter.base, quarter.quote].map((value) => value.toFixed())).toEqual(["2", "199", "200"]);
    });

    it("removes every share at 100%", () => {
        expect(removeEstimate(PAGE_BZE, mine, TOTAL, 100).lpTokens.toFixed()).toBe("100000001");
    });

    it("is empty when the part rounds to no share", () => {
        const none = removeEstimate(PAGE_BZE, new BigNumber(1), TOTAL, 25);

        expect([none.lpTokens, none.base, none.quote].map((value) => value.toFixed())).toEqual(["0", "0", "0"]);
    });
});

describe("liquidity messages", () => {
    it("asks for at least the expected shares minus the slippage, rounded down", () => {
        expect(addLiquidityMessage("bze1me", PAGE_BZE.id, new BigNumber(10e6), new BigNumber(40e6), new BigNumber(999), 1)).toEqual({
            typeUrl: "/bze.tradebin.MsgAddLiquidity",
            value: {creator: "bze1me", poolId: PAGE_BZE.id, baseAmount: "10000000", quoteAmount: "40000000", minLpTokens: "989"},
        });
    });

    it("asks for at least each estimated reserve minus the slippage, rounded down", () => {
        const estimate = {lpTokens: new BigNumber(50e6), base: new BigNumber(50_000_001), quote: new BigNumber(199)};

        expect(removeLiquidityMessage("bze1me", PAGE_BZE.id, estimate, 0.5)).toEqual({
            typeUrl: "/bze.tradebin.MsgRemoveLiquidity",
            value: {creator: "bze1me", poolId: PAGE_BZE.id, lpTokens: "50000000", minBase: "49750000", minQuote: "198"},
        });
    });
});
