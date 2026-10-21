import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import type { Asset, DenomReward } from "@bze/bze-ui-kit";
import {
    TOKENS_PAGE_SIZE,
    adminBadge,
    clampPage,
    filterTokenRows,
    isFactoryToken,
    matchesSearch,
    pageCount,
    pageLinks,
    parseTokensView,
    shortFactoryDenom,
    sortTokenRows,
    stakeText,
    toTokenRow,
    tokensHref,
} from "./tokens-directory";

const CREATOR = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";

function asset(ticker: string, extra: Partial<Asset> = {}): Asset {
    return {
        denom: `factory/${CREATOR}/u${ticker.toLowerCase()}`,
        type: "Factory",
        ticker,
        name: `${ticker} Token`,
        decimals: 6,
        logo: "",
        stable: false,
        verified: false,
        supply: 1_000_000n,
        ...extra,
    };
}

const dr = (a: Asset, staked: string): DenomReward => ({ staking_denom: a.denom, lock: 7, min_stake: "0", staked_amount: staked }) as DenomReward;

const query = (q: string) => (k: string) => new URLSearchParams(q).get(k);

describe("URL state", () => {
    it("parses the filter, the search and the page, with defaults for missing or unknown values", () => {
        expect(parseTokensView(query(""))).toEqual({ filter: "all", q: "", page: 1 });
        expect(parseTokensView(query("filter=stakable&q=hon&page=3"))).toEqual({ filter: "stakable", q: "hon", page: 3 });
        expect(parseTokensView(query("filter=bogus&page=-2"))).toEqual({ filter: "all", q: "", page: 1 });
        expect(parseTokensView(query("page=abc"))).toMatchObject({ page: 1 });
    });

    it("writes the filter always, the search and the page only when set", () => {
        expect(tokensHref()).toBe("/tokens?filter=all");
        expect(tokensHref({ filter: "mine", q: "a b", page: 2 })).toBe("/tokens?filter=mine&q=a+b&page=2");
        expect(tokensHref({ q: "  ", page: 1 })).toBe("/tokens?filter=all");
    });

    it("round-trips", () => {
        const view = { filter: "stakable" as const, q: "factory/bze1", page: 4 };
        expect(parseTokensView(query(tokensHref(view).split("?")[1]))).toEqual(view);
    });
});

describe("grouping by prefix", () => {
    it("keeps factory denoms only: no LP shares, no IBC, no native", () => {
        const denoms = [`factory/${CREATOR}/uhoney`, "ubze", "ibc/ABC", `ulp_factory/${CREATOR}/testusd_ubze`, "ulp/5A5B"];
        expect(denoms.filter(denom => isFactoryToken({ denom }))).toEqual([`factory/${CREATOR}/uhoney`]);
    });
});

describe("search", () => {
    it("matches name, ticker or denom, ignoring case and outer spaces", () => {
        const honey = asset("HONEY", { name: "Sweet Honey" });
        expect(matchesSearch(honey, "")).toBe(true);
        expect(matchesSearch(honey, "sweet")).toBe(true);
        expect(matchesSearch(honey, " hon ")).toBe(true);
        expect(matchesSearch(honey, "z3mkcr")).toBe(true);
        expect(matchesSearch(honey, "milk")).toBe(false);
    });
});

describe("sort", () => {
    it("staked value first, then A–Z by ticker", () => {
        const [a, b, c, d] = ["DELTA", "ALPHA", "CHARLIE", "BRAVO"].map(t => asset(t));
        const rows = [
            toTokenRow(a, undefined, undefined),
            toTokenRow(b, undefined, undefined),
            toTokenRow(c, dr(c, "5000000"), undefined),
            toTokenRow(d, dr(d, "0"), undefined),
        ];
        expect(sortTokenRows(rows).map(r => r.asset.ticker)).toEqual(["CHARLIE", "ALPHA", "BRAVO", "DELTA"]);
    });

    it("compares by USD value when both tokens are priced", () => {
        const cheap = asset("CHEAP");
        const dear = asset("DEAR");
        const rows = [
            toTokenRow(cheap, dr(cheap, "1000000000"), new BigNumber("0.001")), // 1,000 × 0.001 = $1
            toTokenRow(dear, dr(dear, "10000000"), new BigNumber("5")), // 10 × 5 = $50
        ];
        expect(sortTokenRows(rows).map(r => r.asset.ticker)).toEqual(["DEAR", "CHEAP"]);
    });
});

describe("Stakable filter and staked text", () => {
    it("keeps the tokens with a denom reward, and says how much is staked", () => {
        const honey = asset("HONEY");
        const milk = asset("MILK");
        const rows = [toTokenRow(honey, dr(honey, "1230000000000"), undefined), toTokenRow(milk, undefined, undefined)];

        expect(filterTokenRows(rows, "stakable").map(r => r.asset.ticker)).toEqual(["HONEY"]);
        expect(filterTokenRows(rows, "all")).toHaveLength(2);
        expect(stakeText(rows[0])).toBe("Stakable · 1,230,000 staked");
        expect(stakeText(rows[1])).toBe("Not stakable yet");
    });
});

describe("paging", () => {
    it("counts pages of 20 and clamps a stale page", () => {
        expect(TOKENS_PAGE_SIZE).toBe(20);
        expect(pageCount(0)).toBe(1);
        expect(pageCount(20)).toBe(1);
        expect(pageCount(21)).toBe(2);
        expect(clampPage(9, 41)).toBe(3);
        expect(clampPage(0, 41)).toBe(1);
    });

    it("numbers the first, the last and the current page's neighbours", () => {
        expect(pageLinks(1, 1)).toEqual([1]);
        expect(pageLinks(1, 3)).toEqual([1, 2, 3]);
        expect(pageLinks(1, 8)).toEqual([1, 2, 3, "…", 8]);
        expect(pageLinks(5, 8)).toEqual([1, "…", 4, 5, 6, 7, 8]);
        expect(pageLinks(4, 10)).toEqual([1, "…", 3, 4, 5, "…", 10]);
        expect(pageLinks(10, 10)).toEqual([1, "…", 8, 9, 10]);
    });
});

describe("admin badge", () => {
    it.each([
        ["checking while the lookup runs", undefined, true, "checking", "Checking admin…"],
        ["an error once it failed, never 'no admin'", undefined, false, "error", "Couldn't check admin"],
        ["renounced", "", false, "renounced", "Admin given up"],
        ["you", "bze1me", false, "you", "You are admin"],
        ["transferred", CREATOR, false, "transferred", "Admin is bze1z3…qwg3l"],
    ] as const)("%s", (_, admin, isLoading, kind, label) => {
        expect(adminBadge(admin, "bze1me", isLoading)).toEqual({ kind, label });
    });
});

describe("shortFactoryDenom", () => {
    it("shortens the creator, keeps the subdenom; other denoms stay as they are", () => {
        expect(shortFactoryDenom(`factory/${CREATOR}/uhoney`)).toBe("factory/bze1z3…qwg3l/uhoney");
        expect(shortFactoryDenom("ubze")).toBe("ubze");
    });
});
