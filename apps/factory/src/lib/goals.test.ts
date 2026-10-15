import { describe, it, expect } from "vitest";
import { ALL_TOOLS, GOALS, GOAL_CHIPS, GOAL_GROUPS, filterGoals, goalById } from "./goals";

const DENOM = "factory/bze1owner/uhoney";
const ENC = encodeURIComponent(DENOM);

describe("goal catalogue", () => {
    it("every goal sits in a known group, in the catalogue order", () => {
        const groups = GOAL_GROUPS.map(g => g.id);
        expect(GOALS.every(g => groups.includes(g.group))).toBe(true);
        expect(GOALS.filter(g => g.group === "community").map(g => g.id))
            .toEqual(["stakable", "giftStakers", "reach", "multisend", "campaign", "dailyPrize"]);
        expect(GOALS.every(g => g.synonyms.length === 0)).toBe(true);
    });

    it.each([
        ["createToken", undefined, "/token/new"],
        ["pool", undefined, "/pool/new"],
        ["pool", DENOM, `/pool/new?base=${ENC}`],
        ["stakable", DENOM, `/denom-reward/token?denom=${ENC}`],
        ["giftStakers", DENOM, `/denom-reward/airdrop?denom=${ENC}`],
        ["dailyPrize", DENOM, `/denom-reward/schedule?denom=${ENC}`],
        ["registry", DENOM, `/official?denom=${ENC}`],
        ["brandKit", DENOM, `/manage/token?denom=${ENC}&tab=profile`],
        ["lock", DENOM, `/manage/token?denom=${ENC}&tab=control&lock=1`],
        ["multisend", undefined, "/multisend"],
        ["campaign", undefined, "/reward/new"],
    ] as const)("%s(%s) → %s", (id, denom, href) => {
        expect(goalById(id).href?.(denom)).toBe(href);
    });

    it("chips and tools point at catalogue goals", () => {
        const ids = GOALS.map(g => g.id);
        expect(GOAL_CHIPS.every(c => ids.includes(c.goal))).toBe(true);
        expect(ALL_TOOLS.map(t => t.label)).toEqual([
            "Create token", "Create pool", "Add liquidity", "Create market", "Holder rewards", "Airdrop",
            "Multi-send", "Staking program", "Brand kit", "Chain registry", "Burn", "My creations",
        ]);
    });
});

describe("filterGoals", () => {
    it("matches title, description and tech tag, ignoring case", () => {
        expect(filterGoals(GOALS, "POOL").map(g => g.id)).toEqual(["pool", "addLiquidity"]);
        expect(filterGoals(GOALS, "airdrop").map(g => g.id)).toEqual(["giftStakers", "reach"]);
        expect(filterGoals(GOALS, "  ")).toBe(GOALS);
        expect(filterGoals(GOALS, "zzz")).toEqual([]);
    });
});
