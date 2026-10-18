import {describe, it, expect} from "vitest";
import type {Asset} from "@bze/bze-ui-kit";

import {
    DEFAULT_DIRECTORY_STATE,
    type DirectoryFacts,
    type DirectoryState,
    PAGE_SIZE,
    clampPage,
    directoryQueryString,
    filterSortTokens,
    paginationItems,
    parseDirectoryQuery,
    showingLine,
    filterAndSortFactoryTokens,
    getTotalPages,
    pageSlice,
    tokenPagePath,
} from "./token-directory";

// Minimal Asset factory — only the fields the directory logic reads matter.
function makeAsset(overrides: Partial<Asset> & Pick<Asset, "denom" | "ticker">): Asset {
    return {
        type: "factory",
        decimals: 6,
        name: overrides.ticker,
        logo: "",
        stable: false,
        verified: false,
        supply: 0n,
        ...overrides,
    };
}

const FACTORY_A = makeAsset({denom: "factory/bze1owner/uaaa", ticker: "AAA"});
const FACTORY_B = makeAsset({denom: "factory/bze1owner/ubbb", ticker: "BBB"});
const FACTORY_C = makeAsset({denom: "factory/bze1owner/uccc", ticker: "CCC"});
const NATIVE = makeAsset({denom: "ubze", ticker: "BZE"});
const IBC = makeAsset({
    denom: "ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4",
    ticker: "ATOM",
});

describe("filterAndSortFactoryTokens", () => {
    it("keeps only factory denoms", () => {
        const result = filterAndSortFactoryTokens([FACTORY_A, NATIVE, IBC]);
        expect(result.map((a) => a.denom)).toEqual([FACTORY_A.denom]);
    });

    it("sorts factory tokens alphabetically by ticker", () => {
        const result = filterAndSortFactoryTokens([FACTORY_C, FACTORY_A, FACTORY_B]);
        expect(result.map((a) => a.ticker)).toEqual(["AAA", "BBB", "CCC"]);
    });

    it("does not mutate the input array", () => {
        const input = [FACTORY_C, FACTORY_A];
        const snapshot = [...input];
        filterAndSortFactoryTokens(input);
        expect(input).toEqual(snapshot);
    });

    it("returns an empty array when there are no factory tokens", () => {
        expect(filterAndSortFactoryTokens([NATIVE, IBC])).toEqual([]);
    });
});

describe("getTotalPages", () => {
    it("is at least 1 even with no tokens", () => {
        expect(getTotalPages(0)).toBe(1);
    });

    it("fits a full page on one page", () => {
        expect(getTotalPages(PAGE_SIZE)).toBe(1);
    });

    it("rolls over to a second page one past the page size", () => {
        expect(getTotalPages(PAGE_SIZE + 1)).toBe(2);
    });

    it("rounds partial pages up", () => {
        expect(getTotalPages(PAGE_SIZE * 2 + 3)).toBe(3);
    });
});

describe("clampPage", () => {
    it("clamps below 1 up to 1", () => {
        expect(clampPage(0, 5)).toBe(1);
        expect(clampPage(-3, 5)).toBe(1);
    });

    it("clamps above totalPages down to totalPages", () => {
        expect(clampPage(9, 5)).toBe(5);
    });

    it("leaves an in-range page untouched", () => {
        expect(clampPage(3, 5)).toBe(3);
    });
});

describe("pageSlice", () => {
    const tokens = Array.from({length: 45}, (_, i) => i);

    it("returns the first PAGE_SIZE items on page 1", () => {
        expect(pageSlice(tokens, 1)).toEqual(tokens.slice(0, 20));
    });

    it("returns the next slice on page 2", () => {
        expect(pageSlice(tokens, 2)).toEqual(tokens.slice(20, 40));
    });

    it("returns the remainder on the last page", () => {
        expect(pageSlice(tokens, 3)).toEqual(tokens.slice(40, 45));
        expect(pageSlice(tokens, 3)).toHaveLength(5);
    });
});

describe("tokenPagePath", () => {
    it("URL-encodes the denom in the query string", () => {
        expect(tokenPagePath("factory/bze1owner/uaaa")).toBe(
            "/token?denom=factory%2Fbze1owner%2Fuaaa",
        );
    });

    it("never puts a raw slash in the path", () => {
        const path = tokenPagePath("factory/bze1owner/uaaa");
        expect(path.split("?")[0]).toBe("/token");
        expect(path).not.toContain("factory/bze1owner");
    });
});

describe("parseDirectoryQuery / directoryQueryString", () => {
    const parse = (search: string) => parseDirectoryQuery(new URLSearchParams(search));

    it("reads the defaults from an empty query and writes them as an empty string", () => {
        expect(parse("")).toEqual(DEFAULT_DIRECTORY_STATE);
        expect(directoryQueryString(DEFAULT_DIRECTORY_STATE)).toBe("");
    });

    it("round-trips every non-default value", () => {
        const state: DirectoryState = {q: "page token", filter: "rewards", sort: "cap", page: 3};
        expect(parse(directoryQueryString(state))).toEqual(state);
    });

    it("omits default values one by one", () => {
        expect(directoryQueryString({...DEFAULT_DIRECTORY_STATE, sort: "vol"})).toBe("sort=vol");
        expect(directoryQueryString({...DEFAULT_DIRECTORY_STATE, filter: "tradable"})).toBe("filter=tradable");
        expect(directoryQueryString({...DEFAULT_DIRECTORY_STATE, page: 2})).toBe("page=2");
        expect(directoryQueryString({...DEFAULT_DIRECTORY_STATE, q: "   "})).toBe("");
    });

    it("falls back to the defaults for unknown filter and sort values", () => {
        expect(parse("filter=nope&sort=price")).toEqual(DEFAULT_DIRECTORY_STATE);
    });

    it("clamps a non-numeric, zero or negative page to 1", () => {
        expect(parse("page=abc").page).toBe(1);
        expect(parse("page=0").page).toBe(1);
        expect(parse("page=-2").page).toBe(1);
        expect(parse("page=2.5").page).toBe(1);
        expect(parse("page=4").page).toBe(4);
    });
});

describe("filterSortTokens", () => {
    const token = (ticker: string, extra: Partial<Asset> = {}) =>
        makeAsset({denom: `factory/bze1owner/u${ticker.toLowerCase()}`, ticker, name: `${ticker} Coin`, ...extra});

    const AAA = token("AAA", {verified: true});
    const BBB = token("BBB", {name: "Page Project"});
    const CCC = token("CCC");
    const DDD = token("DDD");
    const ALL = [DDD, CCC, BBB, AAA];

    const facts: DirectoryFacts = {
        holdersPool: new Set([BBB.denom]),
        rewardPrograms: new Set([CCC.denom]),
        tradable: new Set([AAA.denom, CCC.denom]),
        marketCap: new Map([[AAA.denom, 50], [BBB.denom, 900], [CCC.denom, 50]]),
        volume: new Map([[DDD.denom, 10], [BBB.denom, 0]]),
    };
    const run = (patch: Partial<DirectoryState>) =>
        filterSortTokens(ALL, {...DEFAULT_DIRECTORY_STATE, ...patch}, facts).map((a) => a.ticker);

    it("sorts by ticker by default", () => {
        expect(run({})).toEqual(["AAA", "BBB", "CCC", "DDD"]);
    });

    it("searches name, ticker and full denom, trimmed and case-insensitive", () => {
        expect(run({q: "  page "})).toEqual(["BBB"]);
        expect(run({q: "ccc"})).toEqual(["CCC"]);
        expect(run({q: "FACTORY/BZE1OWNER/UDDD"})).toEqual(["DDD"]);
        expect(run({q: "nothing"})).toEqual([]);
    });

    it("filters verified, rewards (DR or active SR) and tradable tokens", () => {
        expect(run({filter: "verified"})).toEqual(["AAA"]);
        expect(run({filter: "rewards"})).toEqual(["BBB", "CCC"]);
        expect(run({filter: "tradable"})).toEqual(["AAA", "CCC"]);
    });

    it("sorts by market cap descending, ties by ticker, unpriced last", () => {
        expect(run({sort: "cap"})).toEqual(["BBB", "AAA", "CCC", "DDD"]);
    });

    it("sorts by 24h volume descending, zero volume last by ticker", () => {
        expect(run({sort: "vol"})).toEqual(["DDD", "AAA", "BBB", "CCC"]);
    });

    it("combines search, filter and sort", () => {
        expect(run({q: "coin", filter: "rewards", sort: "cap"})).toEqual(["CCC"]);
    });

    it("does not mutate the input", () => {
        const snapshot = [...ALL];
        run({sort: "cap"});
        expect(ALL).toEqual(snapshot);
    });
});

describe("showingLine", () => {
    it("names the range of the page and the total", () => {
        expect(showingLine(53, 1)).toBe("Showing 1–20 of 53 tokens");
        expect(showingLine(53, 3)).toBe("Showing 41–53 of 53 tokens");
        expect(showingLine(1, 1)).toBe("Showing 1–1 of 1 token");
        expect(showingLine(0, 1)).toBe("0 tokens");
    });
});

describe("paginationItems", () => {
    it("lists every page when there are at most 7", () => {
        expect(paginationItems(1, 1)).toEqual([1]);
        expect(paginationItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it("keeps the first, last and neighbouring pages with gaps in between", () => {
        expect(paginationItems(6, 12)).toEqual([1, "gap", 5, 6, 7, "gap", 12]);
    });

    it("widens the row near either edge", () => {
        expect(paginationItems(1, 12)).toEqual([1, 2, 3, 4, "gap", 12]);
        expect(paginationItems(12, 12)).toEqual([1, "gap", 9, 10, 11, 12]);
    });
});
