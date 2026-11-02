import { describe, it, expect } from "vitest";
import type { Asset } from "@bze/bze-ui-kit";

import { filterAssetsBySearch, sortAssetsForDirectory } from "./asset-list";

// Minimal Asset factory — only denom / ticker / name / verified drive the list logic.
function makeAsset(overrides: Partial<Asset> & Pick<Asset, "denom" | "ticker" | "name">): Asset {
    return {
        type: "factory",
        decimals: 6,
        logo: "",
        stable: false,
        verified: false,
        supply: 0n,
        ...overrides,
    };
}

// "ubze" is the chain native denom by default, so isNativeDenom("ubze") === true.
const NATIVE = makeAsset({ denom: "ubze", ticker: "BZE", name: "BeeZee", verified: true });
const VERIFIED_ATOM = makeAsset({ denom: "ibc/ATOM", ticker: "ATOM", name: "Cosmos", verified: true });
const VERIFIED_USDC = makeAsset({ denom: "ibc/USDC", ticker: "USDC", name: "USD Coin", verified: true });
const UNVERIFIED_ABC = makeAsset({ denom: "factory/bze1/uabc", ticker: "ABC", name: "Alpha", verified: false });
const UNVERIFIED_ZED = makeAsset({ denom: "factory/bze1/uzed", ticker: "ZED", name: "Zed", verified: false });
const HALTED_VERIFIED = makeAsset({ denom: "ibc/USDCN", ticker: "USDC.n", name: "Agoric USDC", verified: true, halted: true });
const HALTED_UNVERIFIED = makeAsset({ denom: "factory/bze1/uaaa", ticker: "AAA", name: "Aardvark", verified: false, halted: true });

describe("sortAssetsForDirectory", () => {
    it("puts the native denom first, whatever its name or verified flag", () => {
        const sorted = sortAssetsForDirectory([UNVERIFIED_ABC, VERIFIED_ATOM, NATIVE]);
        expect(sorted[0].denom).toBe("ubze");
    });

    it("orders verified tokens ahead of unverified ones", () => {
        const sorted = sortAssetsForDirectory([UNVERIFIED_ZED, VERIFIED_USDC]);
        expect(sorted.map((a) => a.ticker)).toEqual(["USDC", "ZED"]);
    });

    it("sorts alphabetically by name within the same tier", () => {
        // Both verified and non-native, so it falls through to name: Cosmos < USD Coin.
        const sorted = sortAssetsForDirectory([VERIFIED_USDC, VERIFIED_ATOM]);
        expect(sorted.map((a) => a.name)).toEqual(["Cosmos", "USD Coin"]);
    });

    it("applies native > verified > alphabetical as one ordering", () => {
        const sorted = sortAssetsForDirectory([
            UNVERIFIED_ZED,
            VERIFIED_USDC,
            NATIVE,
            UNVERIFIED_ABC,
            VERIFIED_ATOM,
        ]);
        expect(sorted.map((a) => a.ticker)).toEqual(["BZE", "ATOM", "USDC", "ABC", "ZED"]);
    });

    it("puts halted assets last, even verified ones that sort first by name", () => {
        const sorted = sortAssetsForDirectory([
            HALTED_VERIFIED,
            UNVERIFIED_ZED,
            HALTED_UNVERIFIED,
            NATIVE,
            VERIFIED_ATOM,
        ]);
        expect(sorted.map((a) => a.ticker)).toEqual(["BZE", "ATOM", "ZED", "USDC.n", "AAA"]);
    });

    it("does not mutate the input array", () => {
        const input = [UNVERIFIED_ZED, NATIVE, VERIFIED_ATOM];
        const snapshot = input.map((a) => a.denom);
        sortAssetsForDirectory(input);
        expect(input.map((a) => a.denom)).toEqual(snapshot);
    });
});

describe("filterAssetsBySearch", () => {
    const assets = [NATIVE, VERIFIED_ATOM, UNVERIFIED_ABC];

    it("returns every asset for an empty term", () => {
        expect(filterAssetsBySearch(assets, "")).toHaveLength(3);
    });

    it("matches on name, case-insensitively", () => {
        expect(filterAssetsBySearch(assets, "CoSmOs").map((a) => a.ticker)).toEqual(["ATOM"]);
    });

    it("matches on ticker", () => {
        expect(filterAssetsBySearch(assets, "abc").map((a) => a.ticker)).toEqual(["ABC"]);
    });

    it("moves halted matches after tradable ones, keeping the rest in order", () => {
        const input = [HALTED_UNVERIFIED, VERIFIED_ATOM, HALTED_VERIFIED, UNVERIFIED_ABC];
        // "a" matches every name; the two halted ones keep their relative order at the end.
        expect(filterAssetsBySearch(input, "a").map((a) => a.ticker)).toEqual(["ATOM", "ABC", "AAA", "USDC.n"]);
    });

    it("returns nothing when neither name nor ticker matches", () => {
        expect(filterAssetsBySearch(assets, "zzz")).toEqual([]);
    });

    it("does not mutate the input array", () => {
        const input = [NATIVE, VERIFIED_ATOM];
        const snapshot = [...input];
        filterAssetsBySearch(input, "bze");
        expect(input).toEqual(snapshot);
    });
});
