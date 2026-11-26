import {describe, expect, it} from "vitest";
import {describeVotingPower} from "./dao-power";

const fmt = (a: string) => `${a} BZE`;
const title = (id: string) => (id === "5" ? "Pay the designer" : undefined);

describe("describeVotingPower", () => {
    it("stake DAO: the current power and what counts on each open proposal", () => {
        const view = describeVotingPower("DAO_TYPE_STAKE", {
            current: "100",
            proposals: [{proposal_id: "5", eligible_weight: "100", shares: []}, {proposal_id: "6", eligible_weight: "0", shares: []}],
        }, fmt, title);
        expect(view.headline).toBe("You have 100 BZE voting power");
        expect(view.lines[0]).toMatchObject({counts: true, text: "#5 Pay the designer: your vote counts for 100 BZE"});
        expect(view.lines[1]).toMatchObject({counts: false});
        expect(view.lines[1].text).toMatch(/your stake joined after this proposal started, so it does not count on it/);
    });

    it("no power now but weight on an older proposal still shows that proposal", () => {
        const view = describeVotingPower("DAO_TYPE_STAKE", {current: "0", proposals: [{proposal_id: "6", eligible_weight: "40", shares: []}]}, fmt, title);
        expect(view.headline).toBe("You have no voting power in this DAO");
        expect(view.lines[0].counts).toBe(true);
    });

    it("no power at all: no 'joined after' claim", () => {
        const view = describeVotingPower("DAO_TYPE_STAKE", {current: "0", proposals: [{proposal_id: "6", eligible_weight: "0", shares: []}]}, fmt, title);
        expect(view.lines[0].text).toBe("Proposal #6: you cannot vote on it");
    });

    it("static list: a member, one vote, and a member added after a proposal started", () => {
        const view = describeVotingPower("DAO_TYPE_STATIC_LIST", {
            current: "1",
            proposals: [{proposal_id: "5", eligible_weight: "1", shares: []}, {proposal_id: "6", eligible_weight: "0", shares: []}],
        }, fmt, title);
        expect(view.headline).toBe("You are a member: one member, one vote");
        expect(view.lines[0].text).toBe("#5 Pay the designer: you can vote");
        expect(view.lines[1].text).toMatch(/you were added after this proposal started/);
    });

    it("static list: not a member", () => {
        expect(describeVotingPower("DAO_TYPE_STATIC_LIST", {current: "0", proposals: []}, fmt, title).headline).toBe("You are not a member of this DAO");
    });
});
