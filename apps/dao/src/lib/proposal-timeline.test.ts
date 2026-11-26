import {describe, expect, it} from "vitest";
import {buildTimeline, describeExecutionError} from "./proposal-timeline";
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

describe("buildTimeline", () => {
    it("a voting proposal: submitted with its block, voting ends in the future", () => {
        const items = buildTimeline(base, params, NOW);
        expect(items[0]).toMatchObject({kind: "submitted", height: 100});
        expect(items.at(-1)).toMatchObject({kind: "voting-end", label: "Voting ends", upcoming: true});
    });

    it("an expedited stake proposal shows the earliest early settle (submission + the module's delay)", () => {
        const items = buildTimeline({...base, expedited: true}, params, NOW);
        expect(kinds(items)).toEqual(["submitted", "early", "voting-end"]);
        expect(items[1]).toMatchObject({time: "2026-10-31T10:00:00.000Z", upcoming: false});
    });

    it("a static list has no early-settle step: its members are fixed", () => {
        expect(kinds(buildTimeline({...base, expedited: true, daoType: "DAO_TYPE_STATIC_LIST"}, params, NOW))).toEqual(["submitted", "voting-end"]);
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
