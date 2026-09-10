import {describe, it, expect} from "vitest";
import type {Asset} from "@bze/bze-ui-kit";

import {
    PAGE_SIZE,
    clampPage,
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
