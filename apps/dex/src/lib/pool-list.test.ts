import { describe, it, expect } from "vitest";
import { toBigNumber } from "@bze/bze-ui-kit";
import type { Balance, LiquidityPoolData } from "@bze/bze-ui-kit";
import type { LiquidityPoolSDKType } from "@bze/bzejs/bze/tradebin/store";

import {
    filterPoolsBySearch,
    partitionUserPools,
    sortPools,
    type PoolSortField,
    type PoolSortOrder,
} from "./pool-list";

// Minimal pool — only the fields the list logic reads matter.
function pool(id: string, base: string, quote: string, lpDenom = `ulp/${id}`): LiquidityPoolSDKType {
    return { id, base, quote, lp_denom: lpDenom } as unknown as LiquidityPoolSDKType;
}

function poolData(
    poolId: string,
    { volume, value, apr }: { volume: number; value: number; apr: string },
): LiquidityPoolData {
    return {
        usdVolume: toBigNumber(volume),
        usdValue: toBigNumber(value),
        usdFees: toBigNumber(0),
        isComplete: true,
        apr,
        poolId,
        base: "",
        quote: "",
        baseVolume: toBigNumber(0),
        quoteVolume: toBigNumber(0),
    };
}

function balance(amount: number): Balance {
    return { denom: "ulp", amount: toBigNumber(amount) };
}

const POOL_A = pool("A", "ubze", "uusdc");
const POOL_B = pool("B", "factory/bze1/uatom", "ubze");
const POOL_C = pool("C", "factory/bze1/ubtc", "uusdc");

const DATA = new Map<string, LiquidityPoolData>([
    ["A", poolData("A", { volume: 100, value: 5000, apr: "12.50" })],
    ["B", poolData("B", { volume: 300, value: 1000, apr: "40.00" })],
    ["C", poolData("C", { volume: 200, value: 9000, apr: "5.00" })],
]);

function sortIds(field: PoolSortField, order: PoolSortOrder): string[] {
    return sortPools([POOL_A, POOL_B, POOL_C], DATA, field, order).map((p) => p.id);
}

describe("sortPools", () => {
    it("sorts by total liquidity descending (usdValue)", () => {
        expect(sortIds("totalLiquidity", "desc")).toEqual(["C", "A", "B"]);
    });

    it("sorts by total liquidity ascending", () => {
        expect(sortIds("totalLiquidity", "asc")).toEqual(["B", "A", "C"]);
    });

    it("sorts by 24h volume descending (usdVolume)", () => {
        expect(sortIds("volume24h", "desc")).toEqual(["B", "C", "A"]);
    });

    it("sorts by APR descending (parsed from the string field)", () => {
        expect(sortIds("apr", "desc")).toEqual(["B", "A", "C"]);
    });

    it("pushes pools with no market data to the end", () => {
        const partial = new Map([["A", poolData("A", { volume: 100, value: 5000, apr: "12.50" })]]);
        const sorted = sortPools([POOL_B, POOL_A, POOL_C], partial, "totalLiquidity", "desc");
        // Only A has data, so it leads; B and C (no data) trail.
        expect(sorted[0].id).toBe("A");
        expect(sorted.slice(1).map((p) => p.id).sort()).toEqual(["B", "C"]);
    });

    it("does not mutate the input array", () => {
        const input = [POOL_A, POOL_B, POOL_C];
        const snapshot = input.map((p) => p.id);
        sortPools(input, DATA, "totalLiquidity", "desc");
        expect(input.map((p) => p.id)).toEqual(snapshot);
    });
});

describe("filterPoolsBySearch", () => {
    const ticker: Record<string, string> = {
        ubze: "BZE",
        uusdc: "USDC",
        "factory/bze1/uatom": "ATOM",
        "factory/bze1/ubtc": "BTC",
    };
    const denomTicker = (denom: string) => ticker[denom] ?? denom;
    const pools = [POOL_A, POOL_B, POOL_C];

    it("returns every pool for an empty search term", () => {
        expect(filterPoolsBySearch(pools, denomTicker, "").map((p) => p.id)).toEqual(["A", "B", "C"]);
    });

    it("matches on the base ticker", () => {
        // ATOM is the base of pool B only.
        expect(filterPoolsBySearch(pools, denomTicker, "atom").map((p) => p.id)).toEqual(["B"]);
    });

    it("matches on the quote ticker", () => {
        // USDC is the quote of A and C.
        expect(filterPoolsBySearch(pools, denomTicker, "usdc").map((p) => p.id)).toEqual(["A", "C"]);
    });

    it("is case-insensitive", () => {
        expect(filterPoolsBySearch(pools, denomTicker, "BzE").map((p) => p.id)).toEqual(["A", "B"]);
    });

    it("matches on the base-quote pair label", () => {
        // "btc-usdc" is pool C's pair; no single ticker contains it.
        expect(filterPoolsBySearch(pools, denomTicker, "btc-usdc").map((p) => p.id)).toEqual(["C"]);
    });

    it("returns nothing when no ticker matches", () => {
        expect(filterPoolsBySearch(pools, denomTicker, "zzz")).toEqual([]);
    });
});

describe("partitionUserPools", () => {
    it("routes pools with a positive LP balance to userPools, the rest to otherPools", () => {
        const balances: Record<string, Balance | undefined> = {
            "ulp/A": balance(100), // user provides liquidity
            "ulp/B": balance(0), // zero balance
            "ulp/C": undefined, // no balance at all
        };
        const { userPools, otherPools } = partitionUserPools(
            [POOL_A, POOL_B, POOL_C],
            (denom) => balances[denom],
        );

        expect(userPools.map((p) => p.id)).toEqual(["A"]);
        expect(otherPools.map((p) => p.id)).toEqual(["B", "C"]);
    });

    it("treats every pool as 'other' when the user holds no LP tokens", () => {
        const { userPools, otherPools } = partitionUserPools([POOL_A, POOL_B], () => undefined);
        expect(userPools).toEqual([]);
        expect(otherPools.map((p) => p.id)).toEqual(["A", "B"]);
    });
});
