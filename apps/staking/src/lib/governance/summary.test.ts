import { describe, it, expect } from "vitest";
import BigNumber from "bignumber.js";
import type { GovVote } from "@bze/bze-ui-kit";
import { badgeCount, badgeLabel, callout, proposalsText, type OpenProposalsSummary, type SummaryProposal } from "./summary";

const NOW = new Date("2026-10-17T12:00:00Z");

const vote = (option: string): GovVote => ({ proposal_id: "", voter: "bze1me", metadata: "", options: [{ option, weight: "1.000000000000000000" }] } as GovVote);

const p48: SummaryProposal = { id: "48", title: "Upgrade network to v8.2.0", votingEndTime: "2026-10-20T10:13:00Z", vote: null };
const p49: SummaryProposal = { id: "49", title: "Community pool spend", votingEndTime: "2026-10-21T08:00:00Z", vote: null };

const guest = (proposals: SummaryProposal[]): OpenProposalsSummary => ({ connected: false, proposals, power: null });
const wallet = (proposals: SummaryProposal[], power = "25400000000"): OpenProposalsSummary =>
    ({ connected: true, proposals, power: new BigNumber(power) });

describe("proposalsText", () => {
    it("pluralises", () => {
        expect(proposalsText(1)).toBe("1 proposal");
        expect(proposalsText(2)).toBe("2 proposals");
    });
});

describe("badgeCount", () => {
    it("is 0 without a summary", () => {
        expect(badgeCount(undefined)).toBe(0);
    });

    it("counts every open proposal without a wallet", () => {
        expect(badgeCount(guest([p48, p49]))).toBe(2);
    });

    it("counts only the proposals the wallet hasn't voted on itself", () => {
        expect(badgeCount(wallet([{ ...p48, vote: vote("VOTE_OPTION_YES") }, p49]))).toBe(1);
        expect(badgeCount(wallet([{ ...p48, vote: vote("VOTE_OPTION_YES") }]))).toBe(0);
    });
});

describe("badgeLabel", () => {
    it("says what the number counts", () => {
        expect(badgeLabel(wallet([p48]), 1)).toBe("1 proposal needs your vote");
        expect(badgeLabel(wallet([p48, p49]), 2)).toBe("2 proposals need your vote");
        expect(badgeLabel(guest([p48]), 1)).toBe("1 open proposal");
        expect(badgeLabel(guest([p48, p49]), 2)).toBe("2 open proposals");
    });
});

describe("callout", () => {
    it("is null without a summary or with nothing open", () => {
        expect(callout(undefined, NOW)).toBeNull();
        expect(callout(guest([]), NOW)).toBeNull();
        expect(callout(wallet([]), NOW)).toBeNull();
    });

    it("asks for the vote on one proposal, linking Vote now to its page", () => {
        expect(callout(wallet([p48]), NOW)).toEqual({
            variant: "needs-vote",
            title: "1 proposal needs your vote",
            detail: "Upgrade network to v8.2.0 · voting ends in 2 days 22 hours",
            powerLine: "Until you vote, your validators' votes count for your 25,400 BZE.",
            voteHref: "/governance/48",
        });
    });

    it("asks for the vote on two proposals, naming the first unvoted one and linking to the list", () => {
        const c = callout(wallet([p48, p49]), NOW);
        expect(c).toMatchObject({ title: "2 proposals need your vote", voteHref: "/governance" });
    });

    it("names the first proposal still waiting for the vote", () => {
        const c = callout(wallet([{ ...p48, vote: vote("VOTE_OPTION_NO") }, p49]), NOW);
        expect(c).toMatchObject({
            title: "1 proposal needs your vote",
            detail: "Community pool spend · voting ends in 3 days 20 hours",
            voteHref: "/governance/49",
        });
    });

    it("explains how votes count without voting power", () => {
        expect(callout(wallet([p48], "0"), NOW)).toMatchObject({
            powerLine: "Votes count with the BZE you have staked when voting ends.",
        });
    });

    it("confirms one vote with its deadline", () => {
        expect(callout(wallet([{ ...p48, vote: vote("VOTE_OPTION_YES") }]), NOW)).toEqual({
            variant: "voted",
            detail: "Yes on #48 · you can change it until Oct 20, 2026, 10:13 UTC.",
        });
    });

    it("lists the first vote and counts the rest", () => {
        const c = callout(wallet([{ ...p48, vote: vote("VOTE_OPTION_YES") }, { ...p49, vote: vote("VOTE_OPTION_ABSTAIN") }]), NOW);
        expect(c).toEqual({ variant: "voted", detail: "Yes on #48 · you can change it until Oct 20, 2026, 10:13 UTC. +1 more" });
    });

    it("tells a visitor what is open, linking to the proposal when there is one", () => {
        expect(callout(guest([p48]), NOW)).toEqual({
            variant: "not-connected",
            title: "1 proposal is open for voting",
            detail: "Upgrade network to v8.2.0 · ends in 2 days 22 hours. Stakers vote with their staked BZE.",
            href: "/governance/48",
        });
    });

    it("links a visitor to the list when several are open", () => {
        expect(callout(guest([p48, p49]), NOW)).toMatchObject({ title: "2 proposals are open for voting", href: "/governance" });
    });
});
