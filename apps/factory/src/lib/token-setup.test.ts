import { describe, it, expect } from "vitest";
import { getDexApp } from "@bze/bze-ui-kit";
import { computeTokenSetup, type TokenSetupFacts } from "./token-setup";

const FACTS: TokenSetupFacts = {
    denom: "factory/bze1owner/uhoney",
    ticker: "HONEY",
    supplyLabel: "1,000",
    isLocked: false,
    description: "Sweet",
    brandKit: "set",
    pools: [{ id: "p1", label: "HONEY / BZE" }],
    denomReward: { runningSchedules: 1 },
    hasMarket: true,
    registry: "listed",
};

describe("the pool item", () => {
    it("adds liquidity on the DEX pool page once a pool exists", () => {
        const pool = computeTokenSetup(FACTS).items.find(item => item.key === "pool");
        expect(pool?.state).toBe("done");
        expect(pool?.action).toEqual({
            label: "Add liquidity on DEX",
            href: `${getDexApp().href.replace(/\/$/, "")}/pools/details?id=p1`,
            app: "dex",
        });
    });
});
