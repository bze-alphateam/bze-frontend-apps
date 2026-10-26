import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import type { MarketData } from "@bze/bze-ui-kit";

import { sortMarkets, type MarketSortDeps } from "./market-list";

interface M { base: string; quote: string }

const market = (base: string, quote = "uusdc"): M => ({ base, quote });

function deps(opts: {
    halted?: string[];
    data?: Record<string, number>;
    unverified?: string[];
    usd?: Record<string, number>;
    pricesLoaded?: boolean;
}): MarketSortDeps<M> {
    const usd = opts.usd ?? {};
    return {
        isHalted: (m) => (opts.halted ?? []).includes(m.base),
        getMarketData: (m) => (m.base in (opts.data ?? {}) ? ({ quote_volume: opts.data![m.base] } as MarketData) : undefined),
        isVerified: (m) => !(opts.unverified ?? []).includes(m.base),
        compareValues: opts.pricesLoaded === false
            ? undefined
            : (a, b) => a.amount.multipliedBy(usd[a.denom] ?? 0).comparedTo(b.amount.multipliedBy(usd[b.denom] ?? 0)) ?? 0,
    };
}

const bases = (list: M[]) => list.map((m) => m.base);

describe("sortMarkets", () => {
    it("puts halted markets last and never sorts the input in place", () => {
        const input = [market("halt"), market("a"), market("b")];
        const sorted = sortMarkets(input, deps({ halted: ["halt"], data: { halt: 9, a: 1, b: 2 }, usd: { uusdc: 1 } }));

        expect(bases(sorted)).toEqual(["b", "a", "halt"]);
        expect(bases(input)).toEqual(["halt", "a", "b"]);
    });

    it("ranks markets with data, then verified, then with volume, then by USD volume", () => {
        const sorted = sortMarkets(
            [market("nodata"), market("unverified"), market("novolume"), market("small"), market("big", "ubze")],
            deps({
                data: { unverified: 50, novolume: 0, small: 10, big: 1000 },
                unverified: ["unverified"],
                usd: { uusdc: 1, ubze: 0.5 },
            }),
        );

        expect(bases(sorted)).toEqual(["big", "small", "novolume", "unverified", "nodata"]);
    });

    it("only moves halted markets last while prices are loading", () => {
        const sorted = sortMarkets([market("halt"), market("z"), market("a")], deps({ halted: ["halt"], pricesLoaded: false }));

        expect(bases(sorted)).toEqual(["z", "a", "halt"]);
    });

    it("compares volumes in USD, not raw amounts", () => {
        const sorted = sortMarkets(
            [market("many", "ucheap"), market("few", "udear")],
            deps({ data: { many: 100, few: 10 }, usd: { ucheap: 0.01, udear: 1 } }),
        );

        expect(bases(sorted)).toEqual(["few", "many"]);
        expect(new BigNumber(100).multipliedBy(0.01).lt(10)).toBe(true);
    });
});
