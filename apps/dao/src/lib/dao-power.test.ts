import {describe, expect, it} from "vitest";
import {describeVotingPower} from "./dao-power";

const title = (id: string) => (id === "5" ? "Pay the designer" : undefined);
const p = (proposal_id: string, eligible_weight: string) => ({proposal_id, eligible_weight, shares: []});

describe("describeVotingPower", () => {
    it("a staker: the Staker role, the stake, the weight on each open proposal and 'of' the current when only part counts", () => {
        const view = describeVotingPower("DAO_TYPE_STAKE", {current: "100", proposals: [p("5", "100"), p("6", "40"), p("7", "0")]}, title);
        expect(view.role).toEqual({label: "Staker", active: true});
        expect(view.stake).toBe(true);
        expect(view.current).toBe("100");
        expect(view.lines[0]).toEqual({proposalId: "5", label: "#5 Pay the designer", value: {kind: "weight", amount: "100", of: null}});
        expect(view.lines[1]).toEqual({proposalId: "6", label: "Proposal #6", value: {kind: "weight", amount: "40", of: "100"}});
        expect(view.lines[2].value).toEqual({kind: "none"});
        expect(view.notes).toEqual([
            "On #6 only part of your stake counts: you joined or added to it after #6 started.",
            "On #7 your stake doesn't count: you joined or added to it after #7 started.",
        ]);
    });

    it("no stake now but weight on an older proposal: that weight counts, and no 'joined after' claim", () => {
        const view = describeVotingPower("DAO_TYPE_STAKE", {current: "0", proposals: [p("6", "40"), p("7", "0")]}, title);
        expect(view.role).toEqual({label: "No stake", active: false});
        expect(view.lines[0].value).toEqual({kind: "weight", amount: "40", of: null});
        expect(view.lines[1].value).toEqual({kind: "none"});
        expect(view.notes).toEqual([]);
    });

    it("a member: the Member role, its vote on each open proposal (null: not voted, undefined: unknown)", () => {
        const voted = (id: string) => ({"5": "YES", "6": null}[id]);
        const view = describeVotingPower("DAO_TYPE_STATIC_LIST", {current: "1", proposals: [p("5", "1"), p("6", "1"), p("8", "1")]}, title, voted);
        expect(view.role).toEqual({label: "Member", active: true});
        expect(view.lines.map((l) => l.value)).toEqual([
            {kind: "member", voted: "YES"},
            {kind: "member", voted: null},
            {kind: "member", voted: undefined},
        ]);
    });

    it("a member added after a proposal started cannot vote on it, and is told why", () => {
        const view = describeVotingPower("DAO_TYPE_STATIC_LIST", {current: "1", proposals: [p("6", "0")]}, title);
        expect(view.lines[0].value).toEqual({kind: "none"});
        expect(view.notes).toEqual(["You were added after #6 started, so you can't vote on it."]);
    });

    it("not a member", () => {
        const view = describeVotingPower("DAO_TYPE_STATIC_LIST", {current: "0", proposals: [p("6", "0")]}, title);
        expect(view.role).toEqual({label: "Not a member", active: false});
        expect(view.notes).toEqual([]);
    });
});
