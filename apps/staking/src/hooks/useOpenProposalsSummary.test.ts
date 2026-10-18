import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { WalletState } from "@interchain-kit/core";

// The shared summary store against mocked ui-kit queries and wallet. The store
// is module-wide, so every test imports a fresh copy of the module.
const q = vi.hoisted(() => ({
    getOpenProposals: vi.fn(),
    getDelegatorDelegations: vi.fn(),
    getValidators: vi.fn(),
    getProposalVote: vi.fn(),
}));
const { useChainMock } = vi.hoisted(() => ({ useChainMock: vi.fn() }));

vi.mock("@interchain-kit/react", () => ({ useChain: () => useChainMock() }));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    ...q,
}));

type Module = typeof import("./useOpenProposalsSummary");
let mod: Module;

const ME = "bze1me";
const VALOPER = "bzevaloper1hive";
const open = (id: string, end: string) => ({ id, title: `Proposal ${id}`, status: "PROPOSAL_STATUS_VOTING_PERIOD", voting_end_time: end, messages: [] });
const yes = { proposal_id: "48", voter: ME, metadata: "", options: [{ option: "VOTE_OPTION_YES", weight: "1" }] };

// Let the mocked queries resolve and React commit.
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

let visibility: DocumentVisibilityState = "visible";

// A fresh import of the module (and ui-kit behind it) is slow under the full parallel run.
const IMPORT_TIMEOUT_MS = 60_000;

beforeEach(async () => {
    visibility = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    for (const fn of Object.values(q)) fn.mockReset();
    q.getOpenProposals.mockResolvedValue([open("49", "2026-10-21T08:00:00Z"), open("48", "2026-10-20T10:13:00Z")]);
    q.getValidators.mockResolvedValue([{ operator_address: VALOPER, description: { moniker: "Hive" } }]);
    q.getDelegatorDelegations.mockResolvedValue([{ delegation: { validator_address: VALOPER }, balance: { denom: "ubze", amount: "25400000000" } }]);
    q.getProposalVote.mockImplementation(async (id: string) => (id === "48" ? yes : null));
    useChainMock.mockReturnValue({ status: WalletState.Disconnected, address: undefined });
    vi.resetModules();
    mod = await import("./useOpenProposalsSummary");
    vi.useFakeTimers();
}, IMPORT_TIMEOUT_MS);

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("useOpenProposalsSummary", () => {
    it("loads the open proposals without a wallet, the one ending first first, and no wallet data", async () => {
        const { result } = renderHook(() => mod.useOpenProposalsSummary());
        expect(result.current.isLoading).toBe(true);
        await flush();

        expect(result.current.isLoading).toBe(false);
        expect(result.current.summary).toEqual({
            connected: false,
            power: null,
            proposals: [
                { id: "48", title: "Proposal 48", votingEndTime: "2026-10-20T10:13:00Z", vote: null },
                { id: "49", title: "Proposal 49", votingEndTime: "2026-10-21T08:00:00Z", vote: null },
            ],
        });
        expect(q.getProposalVote).not.toHaveBeenCalled();
        expect(q.getDelegatorDelegations).not.toHaveBeenCalled();
    });

    it("adds the wallet's own votes and its voting power", async () => {
        useChainMock.mockReturnValue({ status: WalletState.Connected, address: ME });
        const { result } = renderHook(() => mod.useOpenProposalsSummary());
        await flush();

        const summary = result.current.summary!;
        expect(summary.connected).toBe(true);
        expect(summary.power?.toString()).toBe("25400000000");
        expect(summary.proposals.map((p) => [p.id, p.vote])).toEqual([["48", yes], ["49", null]]);
        expect(q.getProposalVote).toHaveBeenCalledWith("48", ME);
        expect(q.getProposalVote).toHaveBeenCalledWith("49", ME);
    });

    it("makes one getOpenProposals call per minute for two consumers", async () => {
        const navbar = renderHook(() => mod.useOpenProposalsSummary());
        const dashboard = renderHook(() => mod.useOpenProposalsSummary());
        await flush();

        expect(q.getOpenProposals).toHaveBeenCalledTimes(1);
        expect(navbar.result.current.summary).toBe(dashboard.result.current.summary);

        // A third consumer mounting inside the window reuses the cache.
        renderHook(() => mod.useOpenProposalsSummary());
        await act(async () => { await vi.advanceTimersByTimeAsync(59_000); });
        expect(q.getOpenProposals).toHaveBeenCalledTimes(1);

        await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
        expect(q.getOpenProposals).toHaveBeenCalledTimes(2);
    });

    it("doesn't re-read while the tab is hidden, and catches up when it shows", async () => {
        renderHook(() => mod.useOpenProposalsSummary());
        await flush();

        visibility = "hidden";
        await act(async () => { await vi.advanceTimersByTimeAsync(180_000); });
        expect(q.getOpenProposals).toHaveBeenCalledTimes(1);

        visibility = "visible";
        await act(async () => {
            document.dispatchEvent(new Event("visibilitychange"));
            await vi.advanceTimersByTimeAsync(0);
        });
        expect(q.getOpenProposals).toHaveBeenCalledTimes(2);
    });

    it("re-reads at once when invalidated, for every consumer", async () => {
        useChainMock.mockReturnValue({ status: WalletState.Connected, address: ME });
        const navbar = renderHook(() => mod.useOpenProposalsSummary());
        const dashboard = renderHook(() => mod.useOpenProposalsSummary());
        await flush();
        expect(navbar.result.current.summary?.proposals[1].vote).toBeNull();

        q.getProposalVote.mockImplementation(async () => yes);
        await act(async () => {
            mod.invalidateOpenProposalsSummary();
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(q.getOpenProposals).toHaveBeenCalledTimes(2);
        expect(navbar.result.current.summary?.proposals[1].vote).toEqual(yes);
        expect(dashboard.result.current.summary?.proposals[1].vote).toEqual(yes);
    });

    it("reports a failure without a summary when a vote can't be read", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        useChainMock.mockReturnValue({ status: WalletState.Connected, address: ME });
        q.getProposalVote.mockRejectedValue(new Error("502"));
        const { result } = renderHook(() => mod.useOpenProposalsSummary());
        await flush();

        expect(result.current.failed).toBe(true);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.summary).toBeUndefined();
    });

    it("reloads for the wallet once it connects", async () => {
        const { result, rerender } = renderHook(() => mod.useOpenProposalsSummary());
        await flush();
        expect(result.current.summary?.connected).toBe(false);

        useChainMock.mockReturnValue({ status: WalletState.Connected, address: ME });
        rerender();
        expect(result.current.isLoading).toBe(true);
        await flush();

        expect(result.current.summary?.connected).toBe(true);
        expect(q.getOpenProposals).toHaveBeenCalledTimes(2);
    });
});
