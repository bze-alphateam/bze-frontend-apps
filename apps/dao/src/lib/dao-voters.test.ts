import {describe, expect, it} from "vitest";
import {dexSourceHref, memberPreview, MEMBERS_PREVIEW, sourceName, sourceRowId, totalVotingPower, type StakeSource} from "./dao-voters";

const sr: StakeSource = {kind: "sr", id: "000000000017", stakingDenom: "ubze", lockDays: 7, staked: "1000"};
const dr: StakeSource = {kind: "dr", stakingDenom: "ubze", lockDays: 5, staked: "250"};

describe("stake sources", () => {
    it("ids follow the DEX staking rows", () => {
        expect(sourceRowId(sr)).toBe("simple:000000000017");
        expect(sourceRowId(dr)).toBe("compounded:ubze");
        expect(dexSourceHref("https://dex.getbze.com/", sr)).toBe("https://dex.getbze.com/staking/details?id=simple%3A000000000017");
    });

    it("totals the staked amounts of all sources", () => {
        expect(totalVotingPower([sr, dr])).toBe("1250");
        expect(totalVotingPower([])).toBe("0");
    });

    it("names", () => {
        expect(sourceName(sr, "BZE")).toBe("Staking reward 17 (BZE)");
        expect(sourceName(dr, "BZE")).toBe("Denom Reward of BZE");
    });
});

describe("memberPreview", () => {
    const list = Array.from({length: MEMBERS_PREVIEW + 3}, (_, i) => i);
    it("cuts a long list until asked", () => {
        expect(memberPreview(list, false)).toEqual({shown: list.slice(0, MEMBERS_PREVIEW), hidden: 3});
        expect(memberPreview(list, true).hidden).toBe(0);
        expect(memberPreview([1, 2], false)).toEqual({shown: [1, 2], hidden: 0});
    });
});
