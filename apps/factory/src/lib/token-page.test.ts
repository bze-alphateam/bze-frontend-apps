import { describe, it, expect } from "vitest";
import { poolLine, stakesToken } from "./token-page";

const TOK = "factory/bze1owner/utok";
const SIDE_TOK = { ticker: "TOK", decimals: 6 };
const SIDE_BZE = { ticker: "BZE", decimals: 6 };

describe("poolLine", () => {
    it("prices the page token in the other one, whichever side it is on", () => {
        const pool = { base: TOK, quote: "ubze", reserve_base: "400000000", reserve_quote: "812000000" };
        expect(poolLine(pool, TOK, SIDE_TOK, SIDE_BZE)).toBe("1 TOK = 2.03 BZE · 400 TOK + 812 BZE in the pool");

        const flipped = { base: "ubze", quote: TOK, reserve_base: "812000000", reserve_quote: "400000000" };
        expect(poolLine(flipped, TOK, SIDE_BZE, SIDE_TOK)).toBe("1 TOK = 2.03 BZE · 812 BZE + 400 TOK in the pool");
    });

    it("gives no price for an empty pool", () => {
        const pool = { base: TOK, quote: "ubze", reserve_base: "0", reserve_quote: "0" };
        expect(poolLine(pool, TOK, SIDE_TOK, SIDE_BZE)).toBe("0 TOK + 0 BZE in the pool");
    });
});

describe("stakesToken", () => {
    const pools = [
        { base: TOK, quote: "ubze", lp_denom: "ulp_tok" },
        { base: "ubze", quote: "uother", lp_denom: "ulp_other" },
    ];

    it("keeps rewards that stake the token or LP shares of its pools", () => {
        expect(stakesToken({ staking_denom: TOK }, TOK, pools)).toBe(true);
        expect(stakesToken({ staking_denom: "ulp_tok" }, TOK, pools)).toBe(true);
    });

    it("leaves out rewards that stake anything else", () => {
        expect(stakesToken({ staking_denom: "ulp_other" }, TOK, pools)).toBe(false);
        expect(stakesToken({ staking_denom: "ubze" }, TOK, pools)).toBe(false);
    });
});
