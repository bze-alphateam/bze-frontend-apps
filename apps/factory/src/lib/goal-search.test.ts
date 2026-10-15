import { describe, it, expect } from "vitest";
import type { Asset } from "@bze/bze-ui-kit";
import { GOALS, SEARCH_TOOLS } from "./goals";
import { MAX_GOAL_RESULTS, normalizeQuery, searchGoals } from "./goal-search";

const CATALOGUE = [...GOALS, ...SEARCH_TOOLS];
const token = (ticker: string, name: string) => ({ denom: `factory/bze1me/u${ticker.toLowerCase()}`, ticker, name, decimals: 6 } as Asset);
const MINE = [token("HONEY", "Honey Coin"), token("JAM", "Strawberry Jam"), token("BEE", "Busy Bee")];

const ids = (query: string) => searchGoals(query, CATALOGUE, MINE).goals.map(g => g.id);

describe("searchGoals", () => {
    it("airdrop: the three airdrop goals first", () => {
        expect(ids("airdrop").slice(0, 3)).toEqual(["giftStakers", "reach", "multisend"]);
    });

    it.each([
        ["logo", "registry"],
        ["list my token", "pool"],
        ["make it stakable", "stakable"],
        ["renounce", "lock"],
        ["csv", "multisend"],
        ["giveaway", "giftStakers"],
        ["create my token", "createToken"],
        ["burn", "burn"],
        ["change admin", "handOver"],
        ["increase supply", "mintMore"],
    ])("%s → %s first", (query, first) => {
        expect(ids(query)[0]).toBe(first);
    });

    it("ignores punctuation, case and extra spaces", () => {
        expect(ids("  AIR-DROP!! ")).toEqual(ids("air drop"));
        expect(ids("Logo?")).toEqual(ids("logo"));
        expect(ids("Cross-Community")[0]).toBe("reach");
        expect(normalizeQuery("  Multi-Send, now ")).toBe("multi send now");
    });

    it("finds the user's tokens by ticker or name, at most 3", () => {
        expect(searchGoals("jam", CATALOGUE, MINE).tokens.map(a => a.ticker)).toEqual(["JAM"]);
        expect(searchGoals("busy", CATALOGUE, MINE).tokens.map(a => a.ticker)).toEqual(["BEE"]);
        const many = ["AA1", "AA2", "AA3", "AA4"].map(t => token(t, t));
        expect(searchGoals("aa", CATALOGUE, many).tokens).toHaveLength(3);
    });

    it("no match, or an empty query, finds nothing", () => {
        expect(searchGoals("qwertyuiop", CATALOGUE, MINE)).toEqual({ goals: [], tokens: [] });
        expect(searchGoals("  ", CATALOGUE, MINE)).toEqual({ goals: [], tokens: [] });
    });

    it("returns at most 6 goals", () => {
        expect(ids("e").length).toBe(MAX_GOAL_RESULTS);
    });
});
