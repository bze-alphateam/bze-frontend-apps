import {describe, expect, it} from "vitest";
import BigNumber from "bignumber.js";

import {denomsWithRoute, formatPriceImpact, isTradable, minimumOutput, payableTokens} from "./swap";

const T = "factory/bze1owner/upage";
// T/BZE, BZE/USDC, USDC/ATOM, ATOM/OSMO: OSMO is 4 hops away from T.
const POOLS = [
    {base: T, quote: "ubze"},
    {base: "ubze", quote: "uusdc"},
    {base: "uusdc", quote: "uatom"},
    {base: "uatom", quote: "uosmo"},
    {base: "ujuno", quote: "ustars"},
];

const held = (denom: string, amount: string, usd: number) => ({denom, amount: new BigNumber(amount), USDValue: new BigNumber(usd)});

describe("minimumOutput", () => {
    it("takes the slippage off the expected output and rounds down", () => {
        expect(minimumOutput(new BigNumber("1234567.9"), 1).toFixed()).toBe("1222222");
        expect(minimumOutput(new BigNumber(1000), 0.5).toFixed()).toBe("995");
        expect(minimumOutput(new BigNumber(999), 2).toFixed()).toBe("979");
    });
});

describe("formatPriceImpact", () => {
    it("shows two decimals and flags tiny impacts", () => {
        expect(formatPriceImpact(new BigNumber("1.236"))).toBe("1.24%");
        expect(formatPriceImpact(new BigNumber("0.004"))).toBe("<0.01%");
        expect(formatPriceImpact(new BigNumber(0))).toBe("0%");
    });
});

describe("isTradable", () => {
    it("is true only for a token in some pool", () => {
        expect(isTradable(T, POOLS)).toBe(true);
        expect(isTradable("factory/bze1owner/unone", POOLS)).toBe(false);
    });
});

describe("denomsWithRoute", () => {
    it("reaches up to three hops, never T itself", () => {
        expect([...denomsWithRoute(T, POOLS)].sort()).toEqual(["uatom", "ubze", "uusdc"]);
        expect([...denomsWithRoute(T, POOLS, 1)]).toEqual(["ubze"]);
    });
});

describe("payableTokens", () => {
    it("keeps held tokens with a route to T, most valuable first", () => {
        const tokens = payableTokens([
            held("ubze", "5000000", 5),
            held(T, "9000000", 900),
            held("uusdc", "40000000", 40),
            held("uatom", "0", 0),
            held("uosmo", "7000000", 70),
            held("ujuno", "1000000", 100),
        ], T, POOLS);

        expect(tokens.map((token) => token.denom)).toEqual(["uusdc", "ubze"]);
    });
});
