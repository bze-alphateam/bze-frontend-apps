import {describe, expect, it, vi} from "vitest";
import type {DaoProposalStatus} from "@bze/bze-ui-kit";
import {ScanUnavailableError} from "./dao-scan";
import {ScanRefusedError, type DaoProposalScan} from "./dao-proposal-scan";
import type {ProposalChain, ProposalDeps} from "./proposal-loader";
import type {ProposalRow} from "./proposal-model";
import {
    activeRuleAfter, loadProposalPage, parseProposalFilter, resultLine, rowStatus, segmentCounts, turnoutShare, whenLine, yesShare,
    type ProposalFilter,
} from "./proposal-list";
import type {ScanProposalPage, ScanProposalSummary} from "./proposal-types";
import {PROPOSAL} from "@/test/proposal-fixtures";

const item = (id: number, status: string | null, over: Partial<ScanProposalSummary> = {}): ScanProposalSummary => ({
    id, dao_id: 4, title: status === null ? null : `P${id}`, status, proposer: "bze1p", proposer_label: null, expedited: false,
    submit_time: null, voting_end: null, yes: "0", no: "0", abstain: "0", denominator: "10", settled_height: null, message_types: [],
    ...over,
});

const row = (id: string, status: DaoProposalStatus, votingEnd: string | null = null): ProposalRow =>
    ({id, title: `P${id}`, status, proposer: "", votingEnd, expedited: false, tally: null});

const deps = (listForDao: DaoProposalScan["listForDao"], chain: Partial<ProposalChain> = {}): ProposalDeps => ({
    scan: {listForDao, detail: vi.fn(async () => null), votes: vi.fn(async () => null)},
    chain: {getDaoProposals: vi.fn(async () => ({items: [], nextKey: null})), ...chain} as unknown as ProposalChain,
});

const DOWN = async (): Promise<ScanProposalPage> => { throw new ScanUnavailableError("down"); };
const REFUSED = async (): Promise<ScanProposalPage> => { throw new ScanRefusedError("400"); };

describe("the status filter", () => {
    it("maps each segment to Scan's status values", async () => {
        const all: ProposalFilter[] = ["all", "active", "passed", "rejected", "expired", "cancelled"];
        const asked: string[][] = [];
        for (const filter of all) {
            const listForDao = vi.fn<DaoProposalScan["listForDao"]>(async () => ({items: [], next_cursor: null, total: 0, status_counts: {}}));
            await loadProposalPage(deps(listForDao), "4", filter, {page: 1});
            asked.push(listForDao.mock.calls[0][1].statuses ?? []);
        }
        expect(asked).toEqual([[], ["active"], ["executed"], ["rejected"], ["expired"], ["cancelled"]]);
    });

    it("reads ?status=, anything unknown is All", () => {
        expect(parseProposalFilter("passed")).toBe("passed");
        expect(parseProposalFilter("executed")).toBe("all");
        expect(parseProposalFilter(null)).toBe("all");
    });
});

describe("segmentCounts", () => {
    it("Active is voting + execution failed, All the sum, Passed the executed ones", () => {
        expect(segmentCounts({voting: 3, execution_failed: 1, executed: 8, rejected: 3, expired: 2, cancelled: 1}))
            .toEqual({all: 18, active: 4, passed: 8, rejected: 3, expired: 2, cancelled: 1});
    });

    it("a status Scan leaves out counts 0", () => {
        expect(segmentCounts({voting: 1}).cancelled).toBe(0);
    });

    it("without status_counts every segment has no count", () => {
        for (const counts of [null, undefined]) {
            expect(Object.values(segmentCounts(counts)).every((c) => c === null)).toBe(true);
        }
    });
});

describe("active first and the rule", () => {
    it("orders the lists it builds itself: voting by the soonest end (ready to settle first), then failed executions newest first", async () => {
        // the chain's live proposals with Scan down, newest first by id as the chain lists them
        const getDaoProposals = vi.fn(async () => ({
            items: [
                {...PROPOSAL, id: "9", voting_end: "1793000000"},
                {...PROPOSAL, id: "8", voting_end: "1795000000"},
                {...PROPOSAL, id: "7", status: "EXECUTION_FAILED" as const},
                {...PROPOSAL, id: "6", status: "EXECUTION_FAILED" as const},
                {...PROPOSAL, id: "5", voting_end: "1793000000"},
            ],
            nextKey: null,
        }));
        const page = await loadProposalPage(deps(DOWN, {getDaoProposals}), "4", "active", {page: 1});
        expect(page.state === "ok" && page.items.map((r) => r.id)).toEqual(["5", "9", "8", "7", "6"]);
    });

    it("draws the rule after the last active row when finished ones follow", () => {
        expect(activeRuleAfter([row("9", "VOTING"), row("7", "EXECUTION_FAILED"), row("5", "EXECUTED")])).toBe(1);
    });

    it("no rule when the page is all active, has none, or is not ordered active first", () => {
        expect(activeRuleAfter([row("9", "VOTING")])).toBeNull();
        expect(activeRuleAfter([row("5", "EXECUTED"), row("4", "REJECTED")])).toBeNull();
        expect(activeRuleAfter([row("5", "EXECUTED"), row("9", "VOTING")])).toBeNull();
        expect(activeRuleAfter([row("9", "VOTING"), row("5", "EXECUTED"), row("8", "VOTING")])).toBeNull();
        expect(activeRuleAfter([])).toBeNull();
    });
});

describe("the Yes and Turnout columns", () => {
    it("rounds down; a dash before any vote or without a tally", () => {
        const tally = {yes: "7500", no: "500", abstain: "0", denominator: "10000"};
        expect(yesShare(tally)).toBe("93.75%");
        expect(turnoutShare(tally)).toBe("80%");
        expect(yesShare({yes: "0", no: "0", abstain: "5", denominator: "10"})).toBe("—");
        expect(yesShare(null)).toBe("—");
        expect(turnoutShare(null)).toBe("—");
    });
});

describe("the Yes · turnout column", () => {
    it("one cell, the board's spacing, a dash without a tally", () => {
        expect(resultLine({yes: "7500", no: "500", abstain: "0", denominator: "10000"})).toBe("93.75 % · 80 %");
        expect(resultLine({yes: "0", no: "0", abstain: "5", denominator: "10"})).toBe("— · 50 %");
        expect(resultLine(null)).toBe("—");
    });
});

describe("rowStatus: the board's pills", () => {
    const NOW = Date.parse("2026-11-28T12:00:00Z");
    const past = "2026-11-28T10:00:00Z";
    const future = "2026-12-01T12:00:00Z";
    it("voting is indigo, and 'Ready to settle' in amber once past its end; both live", () => {
        expect(rowStatus({status: "VOTING", votingEnd: future}, NOW)).toEqual({key: "voting", label: "Voting", tone: "indigo", live: true});
        expect(rowStatus({status: "VOTING", votingEnd: past}, NOW)).toEqual({key: "settle", label: "Ready to settle", tone: "amber", live: true});
        expect(rowStatus({status: "VOTING", votingEnd: null}, NOW).key).toBe("voting");
    });
    it("the finished ones: passed (executed or failed), and the neutral three", () => {
        expect(rowStatus({status: "EXECUTION_FAILED", votingEnd: past}, NOW)).toEqual({key: "failed", label: "Passed · execution failed", tone: "red", live: true});
        expect(rowStatus({status: "EXECUTED", votingEnd: past}, NOW)).toMatchObject({label: "Passed · executed", tone: "green", live: false});
        expect(rowStatus({status: "REJECTED", votingEnd: past}, NOW)).toMatchObject({label: "Rejected", tone: "neutral"});
        expect(rowStatus({status: "EXPIRED", votingEnd: past}, NOW)).toMatchObject({label: "Expired", tone: "neutral"});
        expect(rowStatus({status: "CANCELLED", votingEnd: past}, NOW)).toMatchObject({label: "Cancelled", tone: "neutral"});
    });
});

describe("whenLine", () => {
    const NOW = Date.parse("2026-11-28T12:00:00Z");
    it("voting: 'Ends in …', then 'Voting ended … ago'; finished: the day, or closed early", () => {
        expect(whenLine({status: "VOTING", votingEnd: "2026-12-01T12:00:00Z"}, NOW, "in 3 days", "1 Dec 2026")).toBe("Ends in 3 days");
        expect(whenLine({status: "VOTING", votingEnd: "2026-11-28T10:00:00Z"}, NOW, "2 hours ago", "28 Nov 2026")).toBe("Voting ended 2 hours ago");
        expect(whenLine({status: "EXECUTED", votingEnd: "2026-11-12T10:00:00Z"}, NOW, "16 days ago", "12 Nov 2026")).toBe("Voting ended 12 Nov 2026");
        expect(whenLine({status: "CANCELLED", votingEnd: "2026-12-01T12:00:00Z"}, NOW, "in 3 days", "1 Dec 2026")).toBe("Closed before its planned end");
        expect(whenLine({status: "VOTING", votingEnd: null}, NOW, "", "")).toBe("");
    });
});

describe("loadProposalPage", () => {
    const counts = {voting: 1, execution_failed: 1, executed: 0, rejected: 1, expired: 0, cancelled: 1};

    it("with a total: a numbered page, Scan's order and counts, next_cursor not read", async () => {
        const listForDao = vi.fn(async () => ({items: [item(9, "voting"), item(10, "execution_failed"), item(11, "rejected")], next_cursor: "x", total: 4, status_counts: counts}));
        const page = await loadProposalPage(deps(listForDao), "4", "all", {page: 1});
        expect(listForDao).toHaveBeenCalledWith("4", {statuses: [], page: 1, limit: 20});
        expect(page).toMatchObject({state: "ok", source: "scan", mode: "pages", total: 4, next: null, counts});
        if (page.state !== "ok") return;
        expect(page.items.map((r) => r.id)).toEqual(["9", "10", "11"]);
    });

    it("sends the filter's statuses", async () => {
        const listForDao = vi.fn(async () => ({items: [], next_cursor: null, total: 0, status_counts: counts}));
        await loadProposalPage(deps(listForDao), "4", "active", {page: 2});
        expect(listForDao).toHaveBeenCalledWith("4", {statuses: ["active"], page: 2, limit: 20});
    });

    it("without a total (an older Scan): cursor mode with Prev / Next, no counts, placeholders dropped, and stays there", async () => {
        const listForDao = vi.fn(async () => ({items: [item(11, "rejected"), item(4, null)], next_cursor: "c1", total: null, status_counts: null}));
        const d = deps(listForDao);
        const first = await loadProposalPage(d, "4", "all", {page: 3});
        expect(first).toMatchObject({mode: "cursor", total: null, next: "c1", counts: null, returned: 2});
        if (first.state === "ok") expect(first.items.map((r) => r.id)).toEqual(["11"]);
        await loadProposalPage(d, "4", "all", {page: 1, cursor: "c1"});
        expect(listForDao).toHaveBeenLastCalledWith("4", {statuses: [], cursor: "c1", limit: 20});
    });

    it("an older Scan that refuses `active`: voting and failed executions read one by one and merged active first", async () => {
        const listForDao = vi.fn(async (_dao: string, request: {statuses?: string[]}) => {
            if (request.statuses?.[0] === "active") throw new ScanRefusedError("400");
            return request.statuses?.[0] === "voting"
                ? {items: [item(5, "voting", {voting_end: "2026-12-01T00:00:00Z"}), item(9, "voting", {voting_end: "2026-11-01T00:00:00Z"})], next_cursor: null}
                : {items: [item(7, "execution_failed")], next_cursor: null};
        });
        const page = await loadProposalPage(deps(listForDao), "4", "active", {page: 1});
        expect(page).toMatchObject({state: "ok", source: "scan", mode: "pages", total: 3, next: null, counts: null});
        if (page.state === "ok") expect(page.items.map((r) => r.id)).toEqual(["9", "5", "7"]);
        expect(listForDao).toHaveBeenCalledWith("4", {statuses: ["voting"], cursor: null, limit: 50});
        expect(listForDao).toHaveBeenCalledWith("4", {statuses: ["execution_failed"], cursor: null, limit: 50});
    });

    it("the merged Active list of an older Scan is paged here, so ?page=2 is page 2", async () => {
        const voting = Array.from({length: 25}, (_, i) => item(100 - i, "voting", {voting_end: `2026-11-${String(i + 1).padStart(2, "0")}T00:00:00Z`}));
        const listForDao = vi.fn(async (_dao: string, request: {statuses?: string[]}) => {
            if (request.statuses?.[0] === "active") throw new ScanRefusedError("400");
            return {items: request.statuses?.[0] === "voting" ? voting : [], next_cursor: null};
        });
        const page = await loadProposalPage(deps(listForDao), "4", "active", {page: 2});
        expect(page).toMatchObject({mode: "pages", total: 25, returned: 5});
        if (page.state === "ok") expect(page.items.map((r) => r.id)).toEqual(["80", "79", "78", "77", "76"]);
    });

    it("a 400 on another filter is an error, not Scan down", async () => {
        await expect(loadProposalPage(deps(REFUSED), "4", "passed", {page: 1})).rejects.toBeInstanceOf(ScanRefusedError);
    });

    it("Scan down: Active lists the chain's live proposals by key; a later page stays on the chain", async () => {
        const getDaoProposals = vi.fn(async () => ({items: [{...PROPOSAL, id: "3"}, {...PROPOSAL, id: "6", status: "EXECUTION_FAILED" as const}], nextKey: "k2"}));
        const d = deps(vi.fn(DOWN), {getDaoProposals});
        const page = await loadProposalPage(d, "4", "active", {page: 1});
        expect(page).toMatchObject({state: "ok", source: "chain", mode: "cursor", total: null, next: "k2", counts: null});
        if (page.state === "ok") expect(page.items.map((r) => r.id)).toEqual(["3", "6"]);
        expect(getDaoProposals).toHaveBeenCalledWith("4", ["VOTING", "EXECUTION_FAILED"], {key: undefined, limit: 50, reverse: true});

        await loadProposalPage(d, "4", "active", {page: 1, cursor: "k2", source: "chain"});
        expect(getDaoProposals).toHaveBeenLastCalledWith("4", ["VOTING", "EXECUTION_FAILED"], {key: "k2", limit: 50, reverse: true});
        expect(d.scan.listForDao).toHaveBeenCalledTimes(1);
    });

    it("Scan down: every other filter needs BZE Scan", async () => {
        for (const filter of ["all", "passed", "rejected", "expired", "cancelled"] as ProposalFilter[]) {
            expect(await loadProposalPage(deps(DOWN), "4", filter, {page: 1})).toEqual({state: "needs-scan"});
        }
    });

    it("Scan failing on a later page throws instead of switching source", async () => {
        await expect(loadProposalPage(deps(DOWN), "4", "active", {page: 1, cursor: "c1", source: "scan"})).rejects.toBeInstanceOf(ScanUnavailableError);
    });

    it("Scan failing on numbered page 2 throws instead of showing the chain's first page (or needs-scan)", async () => {
        const d = deps(DOWN);
        await expect(loadProposalPage(d, "4", "active", {page: 2})).rejects.toBeInstanceOf(ScanUnavailableError);
        await expect(loadProposalPage(d, "4", "passed", {page: 2})).rejects.toBeInstanceOf(ScanUnavailableError);
        expect(d.chain.getDaoProposals).not.toHaveBeenCalled();
    });
});
