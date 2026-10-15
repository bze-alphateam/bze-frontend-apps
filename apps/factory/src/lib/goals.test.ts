import { describe, it, expect } from "vitest";
import { ALL_TOOLS, GOALS, GOAL_CHIPS, GOAL_GROUPS, SEARCH_TOOLS, goalById } from "./goals";

const DENOM = "factory/bze1owner/uhoney";
const ENC = encodeURIComponent(DENOM);

describe("goal catalogue", () => {
    it("every goal sits in a known group, in the catalogue order", () => {
        const groups = GOAL_GROUPS.map(g => g.id);
        expect(GOALS.every(g => groups.includes(g.group))).toBe(true);
        expect(GOALS.filter(g => g.group === "community").map(g => g.id))
            .toEqual(["stakable", "giftStakers", "reach", "multisend", "campaign", "dailyPrize"]);
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

describe("search entries", () => {
    it("every goal and tool has lower-case synonyms", () => {
        for (const g of [...GOALS, ...SEARCH_TOOLS]) {
            expect(g.synonyms.length).toBeGreaterThan(0);
            expect(g.synonyms.every(s => s === s.toLowerCase())).toBe(true);
        }
    });

    it("tools are search-only and point at the workspace", () => {
        const tool = (id: string) => SEARCH_TOOLS.find(t => t.id === id);
        expect(SEARCH_TOOLS.every(t => t.group === "tool")).toBe(true);
        expect(tool("burn")?.external).toBe(true);
        expect(tool("mintMore")?.href?.()).toBe("/manage");
        expect(tool("mintMore")?.href?.(DENOM)).toBe(`/manage/token?denom=${ENC}&tab=supply`);
        expect(tool("handOver")?.href?.(DENOM)).toBe(`/manage/token?denom=${ENC}&tab=control`);
    });
});
