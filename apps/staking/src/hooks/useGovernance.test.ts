import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

// The hook against mocked chain and proposal queries: what it loads, what it
// hides, and how it pages and polls.
const q = vi.hoisted(() => ({
    getGovParams: vi.fn(),
    getProposalTally: vi.fn(),
    getStakingPool: vi.fn(),
}));
const s = vi.hoisted(() => ({
    loadOpenProposals: vi.fn(),
    loadFinishedProposals: vi.fn(),
}));

vi.mock("@bze/bze-ui-kit", () => q);
vi.mock("@/query/proposals", () => s);

import { GOVERNANCE_POLL_MS, useGovernance } from "./useGovernance";

const proposal = (id: number, status: string) => ({ id: String(id), status, messages: [], title: `P${id}` });
const tally = (yes: string) => ({ yes_count: yes, no_count: "0", no_with_veto_count: "0", abstain_count: "0" });
const CURSOR = "NDc";

beforeEach(() => {
    for (const fn of [...Object.values(q), ...Object.values(s)]) fn.mockReset();
    q.getGovParams.mockResolvedValue({ quorum: "0.334" });
    s.loadOpenProposals.mockResolvedValue([proposal(48, "PROPOSAL_STATUS_VOTING_PERIOD")]);
    q.getStakingPool.mockResolvedValue({ bonded_tokens: "1000", not_bonded_tokens: "0" });
    s.loadFinishedProposals.mockResolvedValue({ proposals: [proposal(47, "PROPOSAL_STATUS_PASSED")], nextCursor: CURSOR });
    q.getProposalTally.mockResolvedValue(tally("10"));
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("useGovernance", () => {
    it("loads params, open proposals with their tallies, bonded tokens and the first finished page", async () => {
        const { result } = renderHook(() => useGovernance());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.error).toBeUndefined();
        expect(result.current.data).toEqual({
            params: { quorum: "0.334" },
            open: [{ proposal: proposal(48, "PROPOSAL_STATUS_VOTING_PERIOD"), tally: tally("10") }],
            bondedTokens: "1000",
            finished: [proposal(47, "PROPOSAL_STATUS_PASSED")],
        });
        expect(result.current.hasOlder).toBe(true);
        expect(q.getProposalTally).toHaveBeenCalledWith("48");
    });

    it("never keeps deposit-period proposals", async () => {
        s.loadOpenProposals.mockResolvedValue([
            proposal(50, "PROPOSAL_STATUS_DEPOSIT_PERIOD"),
            proposal(48, "PROPOSAL_STATUS_VOTING_PERIOD"),
        ]);
        s.loadFinishedProposals.mockResolvedValue({
            proposals: [proposal(49, "PROPOSAL_STATUS_DEPOSIT_PERIOD"), proposal(47, "PROPOSAL_STATUS_PASSED")],
            nextCursor: null,
        });
        const { result } = renderHook(() => useGovernance());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.open.map((o) => o.proposal.id)).toEqual(["48"]);
        expect(result.current.data?.finished.map((p) => p.id)).toEqual(["47"]);
        expect(q.getProposalTally).not.toHaveBeenCalledWith("50");
    });

    it("falls back to Scan's last tally when the node's fails", async () => {
        s.loadOpenProposals.mockResolvedValue([{ ...proposal(48, "PROPOSAL_STATUS_VOTING_PERIOD"), final_tally_result: tally("7") }]);
        q.getProposalTally.mockRejectedValue(new Error("502"));
        const { result } = renderHook(() => useGovernance());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.open[0].tally).toEqual(tally("7"));
    });

    it("keeps an open proposal whose tally failed, without a tally", async () => {
        q.getProposalTally.mockRejectedValue(new Error("502"));
        const { result } = renderHook(() => useGovernance());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.open[0].tally).toBeNull();
    });

    it("reports an error when a query fails, and reload retries", async () => {
        q.getGovParams.mockRejectedValueOnce(new Error("Network Error"));
        const { result } = renderHook(() => useGovernance());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.data).toBeUndefined();

        await act(() => result.current.reload());
        expect(result.current.error).toBeUndefined();
        expect(result.current.data?.open).toHaveLength(1);
    });

    it("still shows the open proposals when the finished list fails, and retries its first page", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        s.loadFinishedProposals.mockRejectedValueOnce(new Error("BZE Scan answered 502"));
        const { result } = renderHook(() => useGovernance());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.error).toBeUndefined();
        expect(result.current.data?.open.map((o) => o.proposal.id)).toEqual(["48"]);
        expect(result.current.data?.finished).toEqual([]);
        expect(result.current.olderError).toBe(true);
        expect(result.current.hasOlder).toBe(false);

        await act(() => result.current.loadOlder());
        expect(s.loadFinishedProposals).toHaveBeenLastCalledWith(null);
        expect(result.current.olderError).toBe(false);
        expect(result.current.data?.finished.map((p) => p.id)).toEqual(["47"]);
        expect(result.current.hasOlder).toBe(true);
    });

    it("appends older pages until the last one", async () => {
        const { result } = renderHook(() => useGovernance());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        s.loadFinishedProposals.mockResolvedValueOnce({ proposals: [proposal(40, "PROPOSAL_STATUS_REJECTED")], nextCursor: null });
        await act(() => result.current.loadOlder());

        expect(s.loadFinishedProposals).toHaveBeenLastCalledWith(CURSOR);
        expect(result.current.data?.finished.map((p) => p.id)).toEqual(["47", "40"]);
        expect(result.current.hasOlder).toBe(false);
    });

    it("flags a failed older page and keeps the list", async () => {
        const { result } = renderHook(() => useGovernance());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        s.loadFinishedProposals.mockRejectedValueOnce(new Error("timeout"));
        await act(() => result.current.loadOlder());

        expect(result.current.olderError).toBe(true);
        expect(result.current.hasOlder).toBe(true);
        expect(result.current.data?.finished).toHaveLength(1);
    });

    it("re-reads the open tallies every minute, only while the tab is visible", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const { result } = renderHook(() => useGovernance());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(q.getProposalTally).toHaveBeenCalledTimes(1);

        q.getProposalTally.mockResolvedValue(tally("25"));
        await act(() => vi.advanceTimersByTimeAsync(GOVERNANCE_POLL_MS));
        expect(q.getProposalTally).toHaveBeenCalledTimes(2);
        expect(result.current.data?.open[0].tally).toEqual(tally("25"));
        // The poll reads only the tallies.
        expect(s.loadOpenProposals).toHaveBeenCalledTimes(1);

        const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
        await act(() => vi.advanceTimersByTimeAsync(GOVERNANCE_POLL_MS));
        expect(q.getProposalTally).toHaveBeenCalledTimes(2);
        visibility.mockRestore();
    });

    it("re-reads the open tallies on demand, after a vote", async () => {
        const { result } = renderHook(() => useGovernance());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(q.getProposalTally).toHaveBeenCalledTimes(1);

        q.getProposalTally.mockResolvedValue(tally("42"));
        await act(() => result.current.refreshTallies());

        expect(q.getProposalTally).toHaveBeenCalledTimes(2);
        expect(result.current.data?.open[0].tally).toEqual(tally("42"));
    });
});
