import { describe, it, expect } from "vitest";
import { getDexApp } from "@bze/bze-ui-kit";
import { computeTokenSetup, setupChips, type TokenSetupFacts } from "./token-setup";

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

describe("setupChips", () => {
    const chips = (patch: Partial<TokenSetupFacts>, isAdmin = true) => setupChips(computeTokenSetup({ ...FACTS, ...patch }).items, isAdmin);

    it("keeps the five page chips in order and counts them", () => {
        const result = chips({ brandKit: "none", registry: "not-listed" });
        expect(result.chips.map(c => c.label)).toEqual(["Created", "Pool", "Stakable", "Logo in wallets", "Brand kit"]);
        expect(result.chips.map(c => c.section)).toEqual(["supply", "trading", "rewards", "details", "details"]);
        expect(result.doneCount).toBe(3);
        expect(result.totalCount).toBe(5);
    });

    it("counts a compounded reward with no running prize as to do", () => {
        const stakable = chips({ denomReward: { runningSchedules: 0 } }).chips.find(c => c.key === "holderRewards");
        expect(stakable?.state).toBe("todo");
    });

    it("leaves the registry out on testnet", () => {
        const result = chips({ registry: "off" });
        expect(result.chips.map(c => c.key)).not.toContain("registry");
        expect(result.totalCount).toBe(4);
    });

    it("says Admin only on an admin item to do, unless the wallet is the admin", () => {
        expect(chips({ brandKit: "none" }, false).chips.find(c => c.key === "brandKit")?.note).toBe("Admin only");
        expect(chips({ brandKit: "none" }, true).chips.find(c => c.key === "brandKit")?.note).toBeUndefined();
        expect(chips({ brandKit: "set" }, false).chips.find(c => c.key === "brandKit")?.note).toBeUndefined();
    });

    it("an admin item can't be done once the admin is given up, and stops counting", () => {
        const result = chips({ brandKit: "none", isLocked: true }, false);
        const brandKit = result.chips.find(c => c.key === "brandKit");
        expect(brandKit).toMatchObject({ state: "impossible", note: "admin given up" });
        expect(result.totalCount).toBe(4);
        const item = computeTokenSetup({ ...FACTS, brandKit: "none", isLocked: true }).items.find(i => i.key === "brandKit");
        expect(item?.detail).toBe("Can't be added once the admin is given up");
    });
});
