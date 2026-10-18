import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

// The hook against mocked ui-kit queries (the address conversion stays real):
// nothing without a wallet, the power from bonded validators only, the
// wallet's and its validators' votes, and a refresh after voting.
const q = vi.hoisted(() => ({
    getDelegatorDelegations: vi.fn(),
    getValidators: vi.fn(),
    getProposalVote: vi.fn(),
}));

vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    ...q,
}));

import { useVoter } from "./useVoter";

// ChainTools on mainnet: operator address and its own account.
const CHAINTOOLS = "bzevaloper1prm55vzlp5u6excqdunwlm4tw254cq943m6e6m";
const CHAINTOOLS_ACCOUNT = "bze1prm55vzlp5u6excqdunwlm4tw254cq94fl9jwy";
const ME = "bze1dte8cgjyxnsg4zmrlhfv4h4hnxv5vy8khzfx4f";

const yes = { proposal_id: "48", voter: "x", metadata: "", options: [{ option: "VOTE_OPTION_YES", weight: "1" }] };

beforeEach(() => {
    for (const fn of Object.values(q)) fn.mockReset();
    q.getValidators.mockResolvedValue([{ operator_address: CHAINTOOLS, description: { moniker: "ChainTools" } }]);
    q.getDelegatorDelegations.mockResolvedValue([
        { delegation: { validator_address: CHAINTOOLS }, balance: { denom: "ubze", amount: "15000000000" } },
        { delegation: { validator_address: "bzevaloper1jailed" }, balance: { denom: "ubze", amount: "820000000" } },
    ]);
    q.getProposalVote.mockImplementation(async (_id: string, voter: string) => (voter === CHAINTOOLS_ACCOUNT ? yes : null));
});

describe("useVoter", () => {
    it("fetches nothing without a wallet", () => {
        const { result } = renderHook(() => useVoter(undefined, ["48"]));

        expect(result.current.isLoading).toBe(false);
        expect(result.current.voterFor("48")).toBeUndefined();
        expect(q.getDelegatorDelegations).not.toHaveBeenCalled();
    });

    it("loads the power and the wallet's and its validators' votes", async () => {
        const { result } = renderHook(() => useVoter(ME, ["48"]));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(q.getProposalVote).toHaveBeenCalledWith("48", ME);
        expect(q.getProposalVote).toHaveBeenCalledWith("48", CHAINTOOLS_ACCOUNT);
        const voter = result.current.voterFor("48")!;
        expect(voter.power.power.toString()).toBe("15000000000");
        expect(voter.power.inactive.toString()).toBe("820000000");
        expect(voter.vote).toBeNull();
        expect(voter.validators.map((v) => [v.moniker, v.vote])).toEqual([["ChainTools", yes]]);
    });

    it("re-reads the wallet's vote after voting", async () => {
        const { result } = renderHook(() => useVoter(ME, ["48"]));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        const calls = q.getProposalVote.mock.calls.filter(([, voter]) => voter === ME).length;

        q.getProposalVote.mockResolvedValue(yes);
        await act(() => result.current.refresh("48"));

        expect(q.getProposalVote.mock.calls.filter(([, voter]) => voter === ME).length).toBe(calls + 1);
        expect(result.current.voterFor("48")?.vote).toEqual(yes);
    });

    it("flags a failed load instead of showing no stake", async () => {
        q.getValidators.mockResolvedValue([]);
        const { result } = renderHook(() => useVoter(ME, ["48"]));
        await waitFor(() => expect(result.current.failed).toBe(true));

        expect(result.current.isLoading).toBe(false);
        expect(result.current.power).toBeUndefined();
    });
});
