import {describe, expect, it} from "vitest";
import type {DaoProposalStatus} from "@bze/bze-ui-kit";
import {canSettleNow, describeStatus, isOpenStatus, statusLabel, statusTone, votingLine} from "./proposal-status";

const flags = {votingEnded: false, expediteSettleable: false, retryDeadline: null};
const read = (status: DaoProposalStatus, over: Partial<typeof flags> = {}) => describeStatus({status, ...flags, ...over});

describe("describeStatus", () => {
    it("voting, in flight, with no note", () => {
        expect(read("VOTING")).toMatchObject({key: "voting", label: "Voting", tone: "info", live: true, note: ""});
    });

    it("voting past its end waits to be settled", () => {
        expect(read("VOTING", {votingEnded: true})).toMatchObject({key: "ended", label: "Voting ended, waiting to be settled", tone: "warning", live: false});
    });

    it("an expedited proposal that already meets its bars says it can be settled early", () => {
        expect(read("VOTING", {expediteSettleable: true}).note).toContain("before the voting period ends");
    });

    it("an execution failure names the retry deadline", () => {
        const view = read("EXECUTION_FAILED", {retryDeadline: "2026-12-01T10:00:00.000Z"});
        expect(view.key).toBe("failed");
        expect(view.note).toContain("retry until 1 Dec 2026, 10:00 UTC");
    });

    it.each([
        ["REJECTED", "rejected", "Rejected", "danger"],
        ["EXECUTED", "executed", "Executed", "success"],
        ["EXPIRED", "expired", "Expired", "neutral"],
        ["CANCELLED", "cancelled", "Cancelled", "neutral"],
    ] as const)("%s", (status, key, label, tone) => {
        expect(read(status)).toMatchObject({key, label, tone, live: false});
        expect(statusLabel(status)).toBe(label);
        expect(statusTone(status)).toBe(tone);
    });
});

describe("isOpenStatus / canSettleNow", () => {
    it("only voting and a failed execution are still moving", () => {
        expect((["VOTING", "EXECUTION_FAILED"] as const).every(isOpenStatus)).toBe(true);
        expect((["REJECTED", "EXECUTED", "EXPIRED", "CANCELLED"] as const).some(isOpenStatus)).toBe(false);
    });

    it("anyone can settle a voting proposal that ended or meets the expedite bars, never another status", () => {
        expect(canSettleNow({status: "VOTING", votingEnded: true, expediteSettleable: false})).toBe(true);
        expect(canSettleNow({status: "VOTING", votingEnded: false, expediteSettleable: true})).toBe(true);
        expect(canSettleNow({status: "VOTING", votingEnded: false, expediteSettleable: false})).toBe(false);
        expect(canSettleNow({status: "EXECUTION_FAILED", votingEnded: true, expediteSettleable: true})).toBe(false);
    });
});

describe("cancelled wording", () => {
    it("covers a proposal the DAO itself submitted and cancelled", () => {
        expect(describeStatus({status: "CANCELLED", votingEnded: false, expediteSettleable: false, retryDeadline: null}).note).toContain("or by the DAO");
    });
});

describe("votingLine", () => {
    const now = Date.parse("2026-11-01T00:00:00Z");
    it("a voting proposal says when voting ends; a past end reads as ended", () => {
        expect(votingLine("VOTING", "2026-11-03T00:00:00Z", now, "in 2 days", "3 Nov")).toBe("Voting ends in 2 days");
        expect(votingLine("REJECTED", "2026-10-30T00:00:00Z", now, "2 days ago", "30 Oct")).toBe("Voting ended 2 days ago");
    });
    it("never says 'Voting ended' for a proposal closed before its planned end", () => {
        expect(votingLine("EXECUTED", "2026-11-03T00:00:00Z", now, "in 2 days", "3 Nov")).toBe("Closed before its planned end (3 Nov)");
        expect(votingLine("CANCELLED", "2026-11-03T00:00:00Z", now, "in 2 days", "3 Nov")).toContain("planned end");
    });
    it("nothing without an end", () => {
        expect(votingLine("VOTING", null, now, "", "")).toBe("");
    });
});
