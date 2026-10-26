import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import type { Asset, DenomReward } from "@bze/bze-ui-kit";
import {
    keepPickerRow,
    pickerAdminLine,
    pickerGroups,
    showMoreLabel,
    sortPickerRows,
    toPickerRow,
    tokenKind,
    type PickerFilter,
} from "./staked-token-picker";

const ME = "bze1me";

function asset(ticker: string, extra: Partial<Asset> = {}): Asset {
    return {
        denom: `factory/bze1other/u${ticker.toLowerCase()}`,
        type: "Factory",
        ticker,
        name: `${ticker} Token`,
        decimals: 6,
        logo: "",
        stable: false,
        verified: false,
        supply: 1000n,
        ...extra,
    };
}

const dr = (a: Asset, staked: string): DenomReward => ({ staking_denom: a.denom, lock: 7, min_stake: "0", staked_amount: staked });

const ALL: PickerFilter = { mode: "makeStakable", q: "", includeLP: true, excludeHalted: false };
const tickers = (rows: { asset: Asset }[]) => rows.map(r => r.asset.ticker);

describe("tokenKind", () => {
    it("names native, community, pool share and IBC tokens", () => {
        expect(tokenKind(asset("BZE", { denom: "ubze", type: "Native" }), "ubze")).toBe("Native token");
        expect(tokenKind(asset("HONEY"))).toBe("Community token");
        expect(tokenKind(asset("LP", { denom: "ulp_factory/x/a_ubze", type: "LP" }))).toBe("LP shares");
        expect(tokenKind(asset("ATOM", { denom: "ibc/ABC", type: "IBC" }))).toBe("IBC token");
    });
});

describe("pickerAdminLine", () => {
    it("says when you are the admin", () => {
        expect(pickerAdminLine(ME, ME, "makeStakable")).toBe("You are admin");
    });

    it("says when admin was given up, and that anyone can still make it stakable", () => {
        expect(pickerAdminLine("", ME, "makeStakable")).toBe("Admin given up · anyone can still make it stakable");
        expect(pickerAdminLine("", ME, "hasCompounded")).toBe("Admin given up");
    });

    it("says nothing when someone else is admin, or the lookup is pending or failed", () => {
        expect(pickerAdminLine("bze1someone", ME, "makeStakable")).toBe("");
        expect(pickerAdminLine(undefined, ME, "makeStakable")).toBe("");
        expect(pickerAdminLine(ME, undefined, "makeStakable")).toBe("");
    });
});

describe("sortPickerRows", () => {
    const priced = asset("PRICED");
    const big = asset("BIG");
    const unpriced = asset("UNPRICED");
    const alpha = asset("ALPHA");
    const zeta = asset("ZETA");

    it("compounded rewards by staked USD value, then those without a price, then the rest A–Z", () => {
        const rows = [
            toPickerRow(zeta, undefined, undefined),
            toPickerRow(unpriced, dr(unpriced, "999000000"), undefined),
            toPickerRow(priced, dr(priced, "10000000"), new BigNumber(1)), // $10
            toPickerRow(alpha, undefined, new BigNumber(5)),
            toPickerRow(big, dr(big, "1000000"), new BigNumber(100)), // $100
        ];
        expect(tickers(sortPickerRows(rows))).toEqual(["BIG", "PRICED", "UNPRICED", "ALPHA", "ZETA"]);
    });

    it("a zero price counts as no price", () => {
        const row = toPickerRow(priced, dr(priced, "10000000"), new BigNumber(0));
        expect(row.stakedUsd).toBeUndefined();
    });
});

describe("keepPickerRow", () => {
    const lp = asset("LP", { denom: "ulp_factory/x/a_ubze", type: "LP" });
    const halted = asset("HALT", { halted: true });
    const honey = asset("HONEY");

    it("searches by ticker, name or denom", () => {
        expect(keepPickerRow(toPickerRow(honey, undefined, undefined), { ...ALL, q: "hon" })).toBe(true);
        expect(keepPickerRow(toPickerRow(honey, undefined, undefined), { ...ALL, q: "HONEY Token" })).toBe(true);
        expect(keepPickerRow(toPickerRow(honey, undefined, undefined), { ...ALL, q: "bze1other" })).toBe(true);
        expect(keepPickerRow(toPickerRow(honey, undefined, undefined), { ...ALL, q: "wax" })).toBe(false);
    });

    it("drops LP shares unless asked, and halted tokens when asked", () => {
        expect(keepPickerRow(toPickerRow(lp, undefined, undefined), ALL)).toBe(true);
        expect(keepPickerRow(toPickerRow(lp, undefined, undefined), { ...ALL, includeLP: false })).toBe(false);
        expect(keepPickerRow(toPickerRow(halted, undefined, undefined), ALL)).toBe(true);
        expect(keepPickerRow(toPickerRow(halted, undefined, undefined), { ...ALL, excludeHalted: true })).toBe(false);
    });

    it("hasCompounded keeps only tokens with a compounded reward", () => {
        const f = { ...ALL, mode: "hasCompounded" as const };
        expect(keepPickerRow(toPickerRow(honey, undefined, undefined), f)).toBe(false);
        expect(keepPickerRow(toPickerRow(honey, dr(honey, "0"), undefined), f)).toBe(true);
    });
});

describe("pickerGroups", () => {
    const mineA = asset("MINE", { denom: `factory/${ME}/umine` });
    const other = asset("OTHER");
    const lp = asset("LP", { denom: "ulp_factory/x/a_ubze", type: "LP" });
    const mine = [toPickerRow(mineA, undefined, undefined)];
    const others = [mineA, other, lp].map(a => toPickerRow(a, undefined, undefined));

    it("All: your tokens in their own group, not repeated under All tokens", () => {
        const g = pickerGroups(mine, others, "all", ALL);
        expect(tickers(g.mine)).toEqual(["MINE"]);
        expect(tickers(g.all)).toEqual(["LP", "OTHER"]);
    });

    it("Created by you: only your group", () => {
        const g = pickerGroups(mine, others, "mine", ALL);
        expect(tickers(g.mine)).toEqual(["MINE"]);
        expect(g.all).toEqual([]);
    });

    it("Pool shares: only LP shares", () => {
        const g = pickerGroups(mine, others, "lp", ALL);
        expect(g.mine).toEqual([]);
        expect(tickers(g.all)).toEqual(["LP"]);
    });

    it("filters both groups", () => {
        const g = pickerGroups(mine, others, "all", { ...ALL, q: "oth" });
        expect(g.mine).toEqual([]);
        expect(tickers(g.all)).toEqual(["OTHER"]);
    });
});

describe("showMoreLabel", () => {
    it("names the page size and the total", () => {
        expect(showMoreLabel(1480)).toBe("Show 20 more · 1,480 tokens");
    });
});
