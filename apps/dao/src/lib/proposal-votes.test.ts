import {describe, expect, it} from "vitest";
import {filterCounts, sourceLabel, votesCount} from "./proposal-votes";

describe("filterCounts", () => {
    it("each option from Scan's counts, All their sum", () => {
        expect(filterCounts({yes: 150, no: 50, abstain: 14})).toEqual({all: 214, YES: 150, NO: 50, ABSTAIN: 14});
    });

    it("no numbers at all without Scan's counts", () => {
        expect(filterCounts(null)).toEqual({all: null, YES: null, NO: null, ABSTAIN: null});
    });
});

describe("votesCount", () => {
    const base = {page: 1, pageSize: 20, memberList: false, allVotes: null};

    it("a range over several pages, a plain count on one", () => {
        expect(votesCount({...base, page: 3, rows: 20, total: 214})).toBe("41–60 of 214 votes");
        expect(votesCount({...base, rows: 1, total: 1})).toBe("1 vote");
        expect(votesCount({...base, rows: 4, total: 4})).toBe("4 votes");
    });

    it("a member list whose every vote fits on one page says one vote per member", () => {
        expect(votesCount({...base, rows: 2, total: 2, memberList: true, allVotes: 2})).toBe("2 votes · one vote per member");
    });

    it("judged on every option's votes, not the filtered total", () => {
        // 45 votes in all, the Yes filter shows 5 of them: they do not all fit on one page
        expect(votesCount({...base, rows: 5, total: 5, memberList: true, allVotes: 45})).toBe("5 votes");
        expect(votesCount({...base, rows: 5, total: 5, memberList: true, allVotes: 12})).toBe("5 votes · one vote per member");
    });

    it("nothing added when every option's votes are not known, or for a stake DAO", () => {
        expect(votesCount({...base, rows: 5, total: 5, memberList: true, allVotes: null})).toBe("5 votes");
        expect(votesCount({...base, rows: 2, total: 2, allVotes: 2})).toBe("2 votes");
    });
});

describe("sourceLabel", () => {
    it("names staking rewards by number and Denom Rewards by their staking denom", () => {
        expect(sourceLabel("sr/000000000017")).toBe("Staking reward 17");
        expect(sourceLabel("dr/uhoney")).toBe("Denom Reward of uhoney");
        expect(sourceLabel("other")).toBe("other");
    });
});
