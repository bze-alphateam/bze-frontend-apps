import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, renderHook, waitFor} from "@testing-library/react";
import type {ProposalChain, ProposalDeps} from "@/lib/proposal-loader";
import {PROPOSAL, RESPONSE, SCAN} from "@/lib/proposal-fixtures";
import {useProposalPage} from "./useProposalPage";

const depsWith = (getProposal: ProposalChain["getProposal"]): ProposalDeps => ({
    chain: {
        getProposal,
        getDao: async () => null,
        getParams: async () => ({}) as never,
        getBallot: async () => null,
        getBallots: async () => ({items: [], nextKey: null}),
        getVotingPower: async () => null,
        getDaoProposals: async () => ({items: [], nextKey: null}),
        getStakingDenom: async () => "ubze",
    },
    scan: {listForDao: async () => ({items: [], next_cursor: null}), detail: async () => SCAN, votes: async () => null},
});

describe("useProposalPage", () => {
    beforeEach(() => vi.useFakeTimers({shouldAdvanceTime: true}));
    afterEach(() => vi.useRealTimers());

    it("polls the chain in place while the proposal is voting and keeps the data when a poll fails", async () => {
        let yes = "300";
        let fail = false;
        const getProposal = vi.fn(async () => {
            if (fail) throw new Error("down");
            return {...RESPONSE, proposal: {...PROPOSAL, yes}};
        });
        const {result} = renderHook(() => useProposalPage(depsWith(getProposal), "7", 1000));
        await waitFor(() => expect(result.current.data?.model.tally?.yes).toBe("300"));

        yes = "400";
        await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
        await waitFor(() => expect(result.current.data?.model.tally?.yes).toBe("400"));
        expect(result.current.load.loading).toBe(false);

        fail = true;
        await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
        expect(result.current.data?.model.tally?.yes).toBe("400");
    });

    it("stops polling once the proposal has left voting", async () => {
        const getProposal = vi.fn(async () => ({...RESPONSE, proposal: {...PROPOSAL, status: "EXECUTED" as const}}));
        const {result} = renderHook(() => useProposalPage(depsWith(getProposal), "7", 1000));
        await waitFor(() => expect(result.current.data?.model.status).toBe("EXECUTED"));
        const calls = getProposal.mock.calls.length;
        await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
        expect(getProposal.mock.calls.length).toBe(calls);
    });
});
