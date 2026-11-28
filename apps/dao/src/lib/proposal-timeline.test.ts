import {describe, expect, it} from "vitest";
import {buildTimeline, describeExecutionError, retryUntil} from "./proposal-timeline";
import type {ScanOutcome} from "./proposal-model";

const NOW = Date.parse("2026-11-01T00:00:00Z");
const params = {min_expedite_delay: "86400s"};
const base = {
    status: "VOTING" as const, expedited: false, daoType: "DAO_TYPE_STAKE", submitTime: "2026-10-30T10:00:00.000Z", submitHeight: "100",
    votingEnd: "2026-11-02T10:00:00.000Z", retryDeadline: null, outcome: null as ScanOutcome | null,
};
const outcome = (over: Partial<ScanOutcome>): ScanOutcome => ({
    settledHeight: null, settledTxHash: null, executed: null, executionError: null, expeditedEarly: null, depositRefunded: null,
    depositDestination: null, cancelledHeight: null, cleanedHeight: null, votesCount: 0, weightDenom: null, submitTxHash: null, ...over,
});
const kinds = (items: ReturnType<typeof buildTimeline>) => items.map((i) => i.kind);

describe("retry until", () => {
    const voting = {...base, msgs: [{"@type": "/cosmos.bank.v1beta1.MsgSend"}]};
    const withWindow = {...params, execution_window: "1209600s"};

    it("while voting: voting_end + the execution window, as the last upcoming step", () => {
        const items = buildTimeline(voting, withWindow, NOW);
        expect(kinds(items)).toEqual(["submitted", "voting-end", "settle-next", "retry-until"]);
        expect(items.at(-1)).toMatchObject({label: "If the actions fail, anyone can retry until then", time: "2026-11-16T10:00:00.000Z", upcoming: true});
        expect(retryUntil(voting, withWindow)).toBe("2026-11-16T10:00:00.000Z");
    });

    it("left out for a text-only proposal and without the module params", () => {
        expect(kinds(buildTimeline({...voting, msgs: []}, withWindow, NOW))).not.toContain("retry-until");
        expect(kinds(buildTimeline(voting, params, NOW))).not.toContain("retry-until");
        expect(kinds(buildTimeline(voting, null, NOW))).not.toContain("retry-until");
    });

    it("once the execution failed the chain's retry_deadline is used instead", () => {
        const failed = {...voting, status: "EXECUTION_FAILED" as const, votingEnd: "2026-10-31T10:00:00.000Z", retryDeadline: "2026-11-20T00:00:00.000Z"};
        const items = buildTimeline(failed, withWindow, NOW);
        expect(kinds(items)).not.toContain("retry-until");
        expect(items.find((i) => i.kind === "retry")).toMatchObject({time: "2026-11-20T00:00:00.000Z"});
        expect(retryUntil(failed, withWindow)).toBeNull();
    });
});

describe("buildTimeline", () => {
    it("a voting proposal: submitted with its block, voting ends in the future, then the settle anyone can send", () => {
        const items = buildTimeline(base, params, NOW);
        expect(items[0]).toMatchObject({kind: "submitted", height: 100});
        expect(items[1]).toMatchObject({kind: "voting-end", label: "Voting ends", upcoming: true});
        expect(items.at(-1)).toMatchObject({kind: "settle-next", label: "Settled: counted, and if it passed its actions run", time: base.votingEnd, upcoming: true});
    });

    it("a finished proposal has no settle still to come", () => {
        expect(kinds(buildTimeline({...base, status: "REJECTED"}, params, NOW))).not.toContain("settle-next");
    });

    it("an expedited stake proposal shows the earliest early settle (submission + the module's delay)", () => {
        const items = buildTimeline({...base, expedited: true}, params, NOW);
        expect(kinds(items)).toEqual(["submitted", "early", "voting-end"]);
        expect(items[1]).toMatchObject({time: "2026-10-31T10:00:00.000Z", upcoming: false});
    });

    it("a static list can settle early any time: its members are fixed, so there is no waiting time", () => {
        const items = buildTimeline({...base, expedited: true, daoType: "DAO_TYPE_STATIC_LIST"}, params, NOW);
        expect(kinds(items)).toEqual(["submitted", "early", "voting-end"]);
        expect(items[1]).toMatchObject({label: "Can settle early: member lists have no waiting time", time: null, detail: "Any time, once the expedite bars are met"});
    });

    it("without the module params the early step is left out", () => {
        expect(kinds(buildTimeline({...base, expedited: true}, null, NOW))).toEqual(["submitted", "voting-end"]);
    });

    it("an executed proposal: settled and executed at the settle's block, voting ended", () => {
        const items = buildTimeline({...base, status: "EXECUTED", outcome: outcome({settledHeight: 2000, executed: true})}, params, NOW);
        expect(kinds(items)).toEqual(["submitted", "voting-end", "settled", "executed"]);
        expect(items[1].label).toBe("Planned voting end (not reached)");
        expect(items[2]).toMatchObject({label: "Settled", height: 2000});
    });

    it("a settle before the end of voting reads as settled early", () => {
        const items = buildTimeline({...base, status: "EXECUTED", outcome: outcome({settledHeight: 1500, expeditedEarly: true})}, params, NOW);
        expect(items.find((i) => i.kind === "settled")!.label).toBe("Settled early");
    });

    it("a failed execution names its reason and the retry deadline", () => {
        const items = buildTimeline(
            {...base, status: "EXECUTION_FAILED", retryDeadline: "2026-11-16T10:00:00.000Z", outcome: outcome({settledHeight: 2000, executionError: "message failed: insufficient funds"})},
            params, NOW,
        );
        expect(kinds(items)).toEqual(["submitted", "voting-end", "settled", "failed", "retry"]);
        expect(items.find((i) => i.kind === "failed")!.detail).toContain("message failed");
        expect(items.at(-1)).toMatchObject({kind: "retry", upcoming: true});
    });

    it("cancelled and cleaned up", () => {
        const items = buildTimeline({...base, status: "CANCELLED", outcome: outcome({cancelledHeight: 300, cleanedHeight: 9000})}, params, NOW);
        expect(kinds(items)).toEqual(["submitted", "voting-end", "cancelled", "cleaned"]);
    });

    it("a proposal settled or cancelled before its end says the planned end was not reached, and a past end reads as ended", () => {
        const early = buildTimeline({...base, status: "EXECUTED", outcome: outcome({settledHeight: 1500, expeditedEarly: true})}, params, NOW);
        expect(early.find((i) => i.kind === "voting-end")).toMatchObject({label: "Planned voting end (not reached)", upcoming: false});
        const late = buildTimeline({...base, status: "REJECTED", votingEnd: "2026-10-31T10:00:00.000Z"}, params, NOW);
        expect(late.find((i) => i.kind === "voting-end")!.label).toBe("Voting ended");
    });

    it("a cancelled proposal shows it from the status alone, with the block when Scan has it", () => {
        expect(kinds(buildTimeline({...base, status: "CANCELLED"}, params, NOW))).toEqual(["submitted", "voting-end", "cancelled"]);
        expect(buildTimeline({...base, status: "CANCELLED"}, params, NOW).at(-1)).toMatchObject({label: "Cancelled", height: null});
        expect(buildTimeline({...base, status: "CANCELLED", outcome: outcome({cancelledHeight: 300})}, params, NOW).at(-1)).toMatchObject({height: 300});
    });

    it("without Scan only the chain's steps are shown", () => {
        expect(kinds(buildTimeline({...base, status: "REJECTED"}, params, NOW))).toEqual(["submitted", "voting-end"]);
    });
});

describe("describeExecutionError", () => {
    it.each([
        "unauthorized signer", "message not allowed", "execution nested too deep", "message panicked", "invalid message", "message failed",
    ])("explains the chain's fixed reason %s", (reason) => {
        const text = describeExecutionError(`${reason}: details`);
        expect(text).toContain(`(${reason})`);
        expect(text.length).toBeGreaterThan(reason.length + 4);
    });

    it("keeps an unknown error as it is and says nothing for none", () => {
        expect(describeExecutionError("something new")).toBe("something new");
        expect(describeExecutionError(null)).toBe("");
    });
});
