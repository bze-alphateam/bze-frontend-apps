import {describe, expect, it} from "vitest";
import {dexSourceHref, stakingDenomFor, memberPreview, MEMBERS_PREVIEW, sourceDetail, sourceName, sourceRowId, totalVotingPower, type StakeSource} from "./dao-voters";

const sr: StakeSource = {kind: "sr", id: "000000000017", stakingDenom: "ubze", lockDays: 7, staked: "1000", own: "0"};
const dr: StakeSource = {kind: "dr", stakingDenom: "ubze", lockDays: 5, staked: "250", own: "0"};

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

    it("leaves out what the DAO itself has staked in its own sources, and never goes below zero", () => {
        expect(totalVotingPower([{...sr, own: "300"}, {...dr, own: "50"}])).toBe("900");
        expect(totalVotingPower([{...sr, own: "5000"}, dr])).toBe("250");
    });

    it("the staking denom comes from a current source, else from a Denom Reward a proposal pinned", () => {
        expect(stakingDenomFor([sr], [{dr_denom: "uother"}])).toBe("ubze");
        expect(stakingDenomFor([], [null, {dr_denom: ""}, {dr_denom: "uold"}])).toBe("uold");
        expect(stakingDenomFor([], [])).toBeUndefined();
    });

    it("names", () => {
        expect(sourceName(sr)).toBe("Simple reward #17");
        expect(sourceName(dr)).toBe("Compounded reward");
        expect(sourceDetail(sr, "BZE")).toBe("BZE · 7-day unstaking lock");
        expect(sourceDetail(dr, "HONEY")).toBe("HONEY · 5-day unstaking lock");
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
