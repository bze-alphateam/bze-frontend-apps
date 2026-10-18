import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

// The hook against mocked chain and proposal queries: what it loads, what it
// hides as not found, and that only an open proposal's tally is polled.
const { getProposal, ...chain } = vi.hoisted(() => ({
    getGovParams: vi.fn(),
    getProposal: vi.fn(),
    getProposalTally: vi.fn(),
    getStakingPool: vi.fn(),
}));
const q = { ...chain, getProposal };

vi.mock("@bze/bze-ui-kit", () => chain);
vi.mock("@/query/proposals", () => ({ loadProposal: getProposal }));

import { GOVERNANCE_POLL_MS } from "./useGovernance";
import { useProposal } from "./useProposal";

const tally = (yes: string) => ({ yes_count: yes, no_count: "0", no_with_veto_count: "0", abstain_count: "0" });
const proposal = (status: string, final = tally("0")) => ({ id: "48", status, messages: [], final_tally_result: final });

beforeEach(() => {
    for (const fn of Object.values(q)) fn.mockReset();
    q.getGovParams.mockResolvedValue({ quorum: "0.334" });
    q.getStakingPool.mockResolvedValue({ bonded_tokens: "1000", not_bonded_tokens: "0" });
    q.getProposal.mockResolvedValue(proposal("PROPOSAL_STATUS_VOTING_PERIOD"));
    q.getProposalTally.mockResolvedValue(tally("10"));
});

afterEach(() => {
    vi.useRealTimers();
});

describe("useProposal", () => {
    it("loads an open proposal with its live tally", async () => {
        const { result } = renderHook(() => useProposal("48"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(q.getProposal).toHaveBeenCalledWith("48");
        expect(result.current.notFound).toBe(false);
        expect(result.current.data).toEqual({
            proposal: proposal("PROPOSAL_STATUS_VOTING_PERIOD"),
            params: { quorum: "0.334" },
            bondedTokens: "1000",
            tally: tally("10"),
        });
    });

    it("uses a finished proposal's final tally", async () => {
        q.getProposal.mockResolvedValue(proposal("PROPOSAL_STATUS_PASSED", tally("90")));
        const { result } = renderHook(() => useProposal("45"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.tally).toEqual(tally("90"));
        expect(q.getProposalTally).not.toHaveBeenCalled();
    });

    it("falls back to Scan's last tally when the node's fails", async () => {
        q.getProposal.mockResolvedValue(proposal("PROPOSAL_STATUS_VOTING_PERIOD", tally("7")));
        q.getProposalTally.mockRejectedValue(new Error("502"));
        const { result } = renderHook(() => useProposal("48"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.tally).toEqual(tally("7"));
    });

    it("keeps an open proposal whose tally failed, without a tally", async () => {
        q.getProposal.mockResolvedValue(proposal("PROPOSAL_STATUS_VOTING_PERIOD", null as never));
        q.getProposalTally.mockRejectedValue(new Error("502"));
        const { result } = renderHook(() => useProposal("48"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.tally).toBeNull();
        expect(result.current.error).toBeUndefined();
    });

    it("reports a deposit-period proposal as not found", async () => {
        q.getProposal.mockResolvedValue(proposal("PROPOSAL_STATUS_DEPOSIT_PERIOD"));
        const { result } = renderHook(() => useProposal("49"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.notFound).toBe(true);
        expect(result.current.data).toBeUndefined();
        expect(q.getProposalTally).not.toHaveBeenCalled();
    });

    it("reports a missing proposal as not found", async () => {
        q.getProposal.mockResolvedValue(null);
        const { result } = renderHook(() => useProposal("999"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.notFound).toBe(true);
    });

    it("reports a non-numeric id as not found without asking the chain", async () => {
        const { result } = renderHook(() => useProposal("abc"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.notFound).toBe(true);
        expect(q.getProposal).not.toHaveBeenCalled();
    });

    it("reports a network error, and reload retries", async () => {
        q.getProposal.mockRejectedValueOnce(new Error("Network Error"));
        const { result } = renderHook(() => useProposal("48"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.notFound).toBe(false);

        await act(() => result.current.reload());
        expect(result.current.error).toBeUndefined();
        expect(result.current.data?.proposal.id).toBe("48");
    });

    it("re-reads an open proposal's tally every minute while the tab is visible", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const { result } = renderHook(() => useProposal("48"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(q.getProposalTally).toHaveBeenCalledTimes(1);

        q.getProposalTally.mockResolvedValue(tally("25"));
        await act(() => vi.advanceTimersByTimeAsync(GOVERNANCE_POLL_MS));
        expect(q.getProposalTally).toHaveBeenCalledTimes(2);
        expect(result.current.data?.tally).toEqual(tally("25"));
        expect(q.getProposal).toHaveBeenCalledTimes(1);

        // A failed poll keeps the last tally.
        q.getProposalTally.mockRejectedValue(new Error("502"));
        await act(() => vi.advanceTimersByTimeAsync(GOVERNANCE_POLL_MS));
        expect(result.current.data?.tally).toEqual(tally("25"));

        const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
        await act(() => vi.advanceTimersByTimeAsync(GOVERNANCE_POLL_MS));
        expect(q.getProposalTally).toHaveBeenCalledTimes(3);
        visibility.mockRestore();
    });

    it("never polls a finished proposal", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        q.getProposal.mockResolvedValue(proposal("PROPOSAL_STATUS_REJECTED"));
        const { result } = renderHook(() => useProposal("47"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await act(() => vi.advanceTimersByTimeAsync(GOVERNANCE_POLL_MS * 3));
        expect(q.getProposalTally).not.toHaveBeenCalled();
    });

    it("re-reads an open proposal's tally on demand, after a vote", async () => {
        const { result } = renderHook(() => useProposal("48"));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(q.getProposalTally).toHaveBeenCalledTimes(1);

        q.getProposalTally.mockResolvedValue(tally("42"));
        await act(() => result.current.refreshTally());

        expect(q.getProposalTally).toHaveBeenCalledTimes(2);
        expect(result.current.data?.tally).toEqual(tally("42"));
    });
});
