import {describe, expect, it} from "vitest";
import {countdown, headerClock, pagePill, shortStampOf, spaced, stampOf, stateCard, tallyWithYes} from "./proposal-view";
import {tallyView} from "./proposal-tally";
import {CONFIG} from "@/test/proposal-fixtures";
import type {ScanOutcome} from "./proposal-model";

const NOW = Date.parse("2026-11-19T08:59:00Z");
const END = "2026-11-22T13:00:00.000Z";

describe("pagePill", () => {
    it("the page's own words and tones for every state", () => {
        const of = (status: Parameters<typeof pagePill>[0]["status"], votingEnded = false, expediteSettleable = false) => pagePill({status, votingEnded, expediteSettleable});
        expect(of("VOTING")).toEqual({key: "voting", label: "Voting", tone: "accent", live: true});
        expect(of("VOTING", true)).toMatchObject({label: "Ready to settle", tone: "warning"});
        expect(of("VOTING", false, true)).toMatchObject({label: "Can settle early", tone: "warning"});
        expect(of("EXECUTION_FAILED")).toMatchObject({label: "Passed · execution failed", tone: "danger", live: true});
        expect(of("EXECUTED")).toMatchObject({label: "Passed · executed", tone: "success", live: false});
        expect(of("REJECTED")).toMatchObject({label: "Rejected", tone: "danger"});
        expect(of("EXPIRED")).toMatchObject({label: "Expired", tone: "neutral"});
        expect(of("CANCELLED")).toMatchObject({label: "Cancelled", tone: "neutral"});
    });
});

describe("dates and the countdown", () => {
    it("writes the timeline's and the header's forms in UTC", () => {
        expect(stampOf(END)).toBe("22 Nov 2026 13:00 UTC");
        expect(shortStampOf(END)).toBe("22 Nov, 13:00 UTC");
        expect(stampOf(null)).toBe("");
        expect(stampOf("not a date")).toBe("");
    });

    it("counts down in its two largest units, and says nothing once past", () => {
        expect(countdown(END, NOW)).toBe("in 3 days 4 hours");
        expect(countdown(END, NOW, true)).toBe("in 3 days 4 h");
        expect(countdown(END, Date.parse("2026-11-21T15:00:00Z"))).toBe("in 22 hours");
        expect(countdown(END, Date.parse("2026-11-22T12:55:00Z"))).toBe("in 5 minutes");
        expect(countdown(END, Date.parse("2026-11-23T00:00:00Z"))).toBe("");
    });

    it("the header clock while voting; nothing once it is decided", () => {
        const p = {status: "VOTING" as const, votingEnded: false, votingEnd: END, expedited: false};
        expect(headerClock(p, NOW)).toBe("Voting ends in 3 days 4 hours · 22 Nov, 13:00 UTC");
        expect(headerClock({...p, expedited: true}, Date.parse("2026-11-21T15:00:00Z"))).toBe("Expedited · ends in 22 hours");
        expect(headerClock({...p, votingEnded: true}, NOW)).toBe("Voting ended · 22 Nov, 13:00 UTC");
        expect(headerClock({...p, status: "EXECUTED"}, NOW)).toBe("");
        // the phone's short form: no date
        expect(headerClock(p, NOW, true)).toBe("Voting ends in 3 days 4 h");
        expect(headerClock({...p, expedited: true}, Date.parse("2026-11-21T15:00:00Z"), true)).toBe("Expedited · ends in 22 h");
    });

    it("puts a space before the percent sign", () => {
        expect(spaced("37.7%")).toBe("37.7 %");
    });
});

const outcome = (over: Partial<ScanOutcome>): ScanOutcome => ({
    settledHeight: null, settledTxHash: null, executed: null, executionError: null, expeditedEarly: null, depositRefunded: null,
    depositDestination: null, cancelledHeight: null, cleanedHeight: null, votesCount: 0, weightDenom: null, submitTxHash: null, ...over,
});
const base = {
    status: "VOTING" as const, votingEnded: false, expediteSettleable: false, retryDeadline: null, archived: false,
    msgs: [{"@type": "/cosmos.bank.v1beta1.MsgSend"}] as never[], outcome: null as ScanOutcome | null,
    tally: {denominator: "1000", yes: "640", no: "0", abstain: "0"},
};
const passing = tallyView(CONFIG, base.tally, false);

describe("stateCard", () => {
    it("nothing while it simply votes", () => {
        expect(stateCard(base, passing, NOW, false)).toBeNull();
    });

    it("voting ended: waiting to be settled, with the outcome and what runs", () => {
        const card = stateCard({...base, votingEnded: true}, passing, NOW, false)!;
        expect(card).toMatchObject({kind: "settle", tone: "warning", title: "Waiting to be settled"});
        expect(card.text).toBe("Voting has ended. Anyone can settle it now: it passes (64 % turnout, 100 % yes) and runs its 1 action in the same transaction.");
        const rejected = tallyView(CONFIG, {denominator: "1000", yes: "10", no: "0", abstain: "0"}, false);
        expect(stateCard({...base, votingEnded: true}, rejected, NOW, false)!.text).toContain("it is rejected");
        expect(stateCard({...base, votingEnded: true}, null, NOW, false)!.text).toBe("Voting has ended. Anyone can settle it now; the chain counts the votes then.");
    });

    it("expedited and over its bars: can settle early, counted in members on a member list", () => {
        const card = stateCard({...base, expediteSettleable: true, tally: {denominator: "5", yes: "4", no: "0", abstain: "0"}}, null, NOW, true)!;
        expect(card).toMatchObject({kind: "early", title: "Can settle early"});
        expect(card.text).toContain("(4 of 5 members said yes)");
    });

    it("a failed execution: retry with the reason and the deadline; after it, mark expired", () => {
        const failed = {...base, status: "EXECUTION_FAILED" as const, retryDeadline: "2026-12-06T13:00:00.000Z", outcome: outcome({executionError: "message failed"})};
        const card = stateCard(failed, passing, NOW, false)!;
        expect(card).toMatchObject({kind: "retry", tone: "danger", title: "Passed · execution failed"});
        expect(card.text).toContain("(message failed)");
        expect(card.text).toContain("until 6 Dec 2026, 13:00 UTC");
        const late = stateCard(failed, passing, Date.parse("2026-12-07T00:00:00Z"), false)!;
        expect(late).toMatchObject({kind: "expire", title: "Too late to retry", text: "The retry window closed on 6 Dec. Settling it again marks it expired; nothing runs."});
    });

    it("finished: how it was settled and what ran; an archived one says it is Scan's record", () => {
        const done = stateCard({...base, status: "EXECUTED", outcome: outcome({settledHeight: 9580112})}, passing, NOW, false)!;
        expect(done).toMatchObject({kind: "finished", tone: "success"});
        expect(done.text).toBe("Settled at block 9,580,112 · 64 % turnout · 100 % yes. Its action ran.");
        expect(stateCard({...base, status: "EXECUTED"}, passing, NOW, false, "The 1,000 HONEY deposit went back to the proposer.")!.text)
            .toBe("Settled · 64 % turnout · 100 % yes. Its action ran. The 1,000 HONEY deposit went back to the proposer.");
        expect(stateCard({...base, status: "EXPIRED"}, passing, NOW, false)!.text).toBe("It passed, but its action kept failing until the retry deadline. Nothing ran.");
    });

    it("rejected: says which bar it missed, nothing ran, where the deposit went", () => {
        const low = tallyView(CONFIG, {denominator: "1000", yes: "150", no: "60", abstain: "0"}, false);
        expect(stateCard({...base, status: "REJECTED", outcome: outcome({settledHeight: 1500})}, low, NOW, false, "The 9 BZE deposit went to the treasury (only refunded if it passes).")!.text)
            .toBe("Settled at block 1,500 · turnout 21 %, below the 40 % quorum. Nothing ran. The 9 BZE deposit went to the treasury (only refunded if it passes).");
        const no = tallyView(CONFIG, {denominator: "1000", yes: "200", no: "300", abstain: "0"}, false);
        expect(stateCard({...base, status: "REJECTED"}, no, NOW, false)!.text).toBe("Settled · 40 % yes, not more than the 50 % it needed. Nothing ran.");
    });

    it("cancelled by its proposer, with the block Scan saw", () => {
        expect(stateCard({...base, status: "CANCELLED", outcome: outcome({cancelledHeight: 300})}, passing, NOW, false)!.text)
            .toBe("Cancelled by its proposer at block 300, before the end of voting. Nothing ran.");
        expect(stateCard({...base, status: "CANCELLED"}, passing, NOW, false)!.text).toBe("Cancelled by its proposer, before the end of voting. Nothing ran.");
    });

    it("archived: Scan's record, how it ended, at which block, and its votes", () => {
        const card = stateCard({...base, archived: true, status: "EXECUTED", outcome: outcome({settledHeight: 2000, votesCount: 14})}, passing, NOW, false)!;
        expect(card).toMatchObject({kind: "archived", text: "Cleaned up from the chain after it finished, so this page reads BZE Scan's record: executed at block 2,000, 14 votes."});
        expect(stateCard({...base, archived: true, status: "REJECTED"}, passing, NOW, false)!.text).toBe("Cleaned up from the chain after it finished, so this page reads BZE Scan's record: rejected.");
    });
});

describe("tallyWithYes", () => {
    it("adds the wallet's yes, taking its old ballot out first", () => {
        const t = {denominator: "5", yes: "2", no: "1", abstain: "0"};
        expect(tallyWithYes(t, null, "1")).toEqual({denominator: "5", yes: "3", no: "1", abstain: "0"});
        expect(tallyWithYes(t, {option: "NO", weight: "1"}, "1")).toEqual({denominator: "5", yes: "3", no: "0", abstain: "0"});
        expect(tallyWithYes(t, {option: "YES", weight: "1"}, "1")).toEqual({denominator: "5", yes: "2", no: "1", abstain: "0"});
        expect(tallyWithYes(null, null, "1")).toBeNull();
        expect(tallyWithYes(t, null, "x")).toBeNull();
    });
});
