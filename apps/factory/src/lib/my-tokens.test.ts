import { describe, it, expect } from "vitest";
import type { Asset } from "@bze/bze-ui-kit";

import { filterMyTokens, toMyTokens } from "./my-tokens";

function asset(denom: string, ticker = "TKN"): Asset {
    return {
        denom,
        ticker,
        name: `${ticker} Token`,
        type: "factory",
        decimals: 6,
        logo: "",
        stable: false,
        verified: false,
        supply: 0n,
    } as Asset;
}

const OWNER = "bze1owner";
const MINE_A = asset(`factory/${OWNER}/uaaa`, "AAA");
const MINE_B = asset(`factory/${OWNER}/ubbb`, "BBB");
const OTHERS = asset("factory/bze1other/uccc", "CCC");
const NATIVE = asset("ubze", "BZE");

describe("filterMyTokens", () => {
    const assets = [MINE_A, OTHERS, NATIVE, MINE_B];

    it("keeps only assets under the address's factory prefix", () => {
        expect(filterMyTokens(assets, OWNER).map((a) => a.denom)).toEqual([
            MINE_A.denom,
            MINE_B.denom,
        ]);
    });

    it("returns nothing when the address owns no factory tokens", () => {
        expect(filterMyTokens([OTHERS, NATIVE], OWNER)).toEqual([]);
    });

    it("returns nothing when there is no connected address", () => {
        expect(filterMyTokens(assets, undefined)).toEqual([]);
        expect(filterMyTokens(assets, "")).toEqual([]);
    });

    it("does not mutate the input array", () => {
        const input = [MINE_A, OTHERS];
        const snapshot = [...input];
        filterMyTokens(input, OWNER);
        expect(input).toEqual(snapshot);
    });
});

describe("toMyTokens", () => {
    it("pairs each asset with its admin address", () => {
        const admins = { [MINE_A.denom]: "bze1admin", [MINE_B.denom]: "" };
        expect(toMyTokens([MINE_A, MINE_B], admins)).toEqual([
            { asset: MINE_A, admin: "bze1admin" },
            { asset: MINE_B, admin: "" },
        ]);
    });

    it("defaults a missing admin entry to an empty string (renounced/unknown)", () => {
        expect(toMyTokens([MINE_A], {})).toEqual([{ asset: MINE_A, admin: "" }]);
    });

    it("treats an undefined admin map (not yet loaded) as all empty", () => {
        expect(toMyTokens([MINE_A], undefined)).toEqual([{ asset: MINE_A, admin: "" }]);
    });
});
