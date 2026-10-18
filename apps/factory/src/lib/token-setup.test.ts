import { describe, it, expect } from "vitest";
import { computeTokenSetup, setupHint, type TokenSetupFacts } from "./token-setup";

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

const hint = (patch: Partial<TokenSetupFacts>) => setupHint(computeTokenSetup({ ...FACTS, ...patch }));

describe("setupHint", () => {
    it("is undefined when everything is set up", () => {
        expect(hint({})).toBeUndefined();
    });

    it("names the first unfinished item, in checklist order", () => {
        expect(hint({ pools: [], hasMarket: false })).toBe("no pool yet");
        expect(hint({ denomReward: "none", hasMarket: false })).toBe("not stakable yet");
        expect(hint({ denomReward: { runningSchedules: 0 } })).toBe("no daily prize running");
        expect(hint({ registry: "not-listed" })).toBe("not in the registry yet");
        expect(hint({ hasMarket: false })).toBe("no market yet");
    });

    it("skips items that are unknown or impossible", () => {
        expect(hint({ brandKit: "error", registry: "error" })).toBeUndefined();
        expect(hint({ isLocked: true, description: "" })).toBeUndefined();
    });
});
