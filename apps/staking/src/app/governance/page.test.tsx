import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { WalletState } from "@interchain-kit/core";
import BigNumber from "bignumber.js";
import type { GovParams, GovProposal, GovTally } from "@bze/bze-ui-kit";
import type { ProposalVoter } from "@/hooks/useVoter";
import { ME, SPLIT, YES, voterOf } from "@/lib/governance/fixtures/voter";

// The page renders off useGovernance, useVoter and the wallet status; all are
// mocked, as are the wallet sidebar and the tx hook (they need their providers).
// The ui-kit helpers and the governance lib stay real.
const { useGovernanceMock, useVoterMock, useChainMock, txMock } = vi.hoisted(() => ({
    useGovernanceMock: vi.fn(),
    useVoterMock: vi.fn(),
    useChainMock: vi.fn(),
    txMock: vi.fn(),
}));

vi.mock("@/hooks/useGovernance", () => ({
    useGovernance: () => useGovernanceMock(),
}));
vi.mock("@/hooks/useVoter", () => ({
    useVoter: (address: string | undefined, ids: string[]) => useVoterMock(address, ids),
}));
vi.mock("@/hooks/useNow", () => ({
    useNow: () => new Date("2026-10-17T12:00:00Z"),
}));
vi.mock("@interchain-kit/react", () => ({
    useChain: () => useChainMock(),
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        Sidebar: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</>,
        WalletSidebarContent: () => null,
        useSDKTx: () => ({ tx: txMock, progressTrack: "" }),
        useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
        useGasFeeEstimate: () => ({ displayAmount: new BigNumber("0.0045"), ticker: "BZE", isLoading: false }),
    };
});

import GovernancePage from "./page";

const PARAMS = {
    quorum: "0.334000000000000000",
    threshold: "0.500000000000000000",
    veto_threshold: "0.334000000000000000",
    expedited_threshold: "0.667000000000000000",
    voting_period: "432000s",
    burn_vote_veto: true,
} as GovParams;

const tally = (yes: string, no = "0", veto = "0", abstain = "0"): GovTally => ({
    yes_count: yes, no_count: no, no_with_veto_count: veto, abstain_count: abstain,
});

function proposal(id: number, status: GovProposal["status"], overrides: Partial<GovProposal> = {}): GovProposal {
    return {
        id: String(id),
        status,
        title: `Proposal title ${id}`,
        summary: "",
        messages: [{ "@type": "/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade" }],
        voting_end_time: "2026-10-20T10:13:59.778Z",
        final_tally_result: tally("0"),
        total_deposit: [],
        metadata: "",
        proposer: "bze1proposer",
        expedited: false,
        failed_reason: "",
        ...overrides,
    } as GovProposal;
}

const OPEN = {
    proposal: proposal(48, "PROPOSAL_STATUS_VOTING_PERIOD", { title: "Upgrade network to v8.2.0" }),
    tally: tally("743"),
};

function governance(overrides: Record<string, unknown> = {}, data: Record<string, unknown> = {}) {
    return {
        data: {
            params: PARAMS,
            open: [OPEN],
            bondedTokens: "1000",
            finished: [
                proposal(47, "PROPOSAL_STATUS_PASSED", {
                    title: "Upgrade network to v8.1.1",
                    voting_end_time: "2026-07-21T10:00:00Z",
                    final_tally_result: tally("90", "10"),
                }),
                proposal(45, "PROPOSAL_STATUS_REJECTED", {
                    title: "Fund Liquidity Pools",
                    messages: [{ "@type": "/cosmos.distribution.v1beta1.MsgCommunityPoolSpend" }],
                }),
            ],
            ...data,
        },
        isLoading: false,
        error: undefined,
        reload: vi.fn(),
        refreshTallies: vi.fn(),
        loadOlder: vi.fn(),
        hasOlder: false,
        isLoadingOlder: false,
        olderError: false,
        ...overrides,
    };
}

function renderPage() {
    return render(<GovernancePage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

function connect(voter?: ProposalVoter, refresh = vi.fn()) {
    useChainMock.mockReturnValue({ status: WalletState.Connected, address: ME });
    useVoterMock.mockReturnValue({ voterFor: () => voter, power: voter?.power, isLoading: false, failed: false, refresh });
    return refresh;
}

beforeEach(() => {
    useGovernanceMock.mockReset();
    useChainMock.mockReset();
    useVoterMock.mockReset();
    txMock.mockReset();
    useChainMock.mockReturnValue({ status: WalletState.Disconnected });
    useVoterMock.mockReturnValue({ voterFor: () => undefined, power: undefined, isLoading: false, failed: false, refresh: vi.fn() });
});

describe("Governance page", () => {
    it("shows skeletons while the first load runs", () => {
        useGovernanceMock.mockReturnValue(governance({ isLoading: true, data: undefined }));
        renderPage();

        expect(screen.getByLabelText("Loading proposals")).toBeInTheDocument();
        expect(screen.queryByText("Open for voting")).not.toBeInTheDocument();
    });

    it("shows the error state, and Try again reloads", async () => {
        const reload = vi.fn();
        useGovernanceMock.mockReturnValue(governance({ data: undefined, error: new Error("down"), reload }));
        renderPage();

        const alert = screen.getByRole("alert");
        expect(within(alert).getByText("Couldn't load proposals")).toBeInTheDocument();
        await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("says there are no proposals when the chain has none", () => {
        useGovernanceMock.mockReturnValue(governance({}, { open: [], finished: [] }));
        renderPage();

        expect(screen.getByText("No proposals yet")).toBeInTheDocument();
        expect(screen.queryByText("Finished")).not.toBeInTheDocument();
    });

    it("shows the empty open card when nothing is open", () => {
        useGovernanceMock.mockReturnValue(governance({}, { open: [] }));
        renderPage();

        expect(screen.getByText("No proposals are open for voting right now")).toBeInTheDocument();
        expect(screen.getByText("Upgrade network to v8.1.1")).toBeInTheDocument();
    });

    it("renders an open proposal card for a visitor", () => {
        useGovernanceMock.mockReturnValue(governance());
        renderPage();

        const card = screen.getByRole("article");
        expect(within(card).getByText("#48")).toBeInTheDocument();
        expect(within(card).getByText("Voting")).toBeInTheDocument();
        expect(within(card).getByText("Software upgrade")).toBeInTheDocument();
        expect(within(card).getByRole("link", { name: "Upgrade network to v8.2.0" })).toHaveAttribute("href", "/governance/48");
        expect(card).toHaveTextContent("Ends in 2 days 22 hours · Oct 20, 2026, 10:13 UTC");
        expect(within(card).getByRole("img", { name: "Tally: Yes 100%, No 0%, No with veto 0%, Abstain 0%" })).toBeInTheDocument();
        expect(card).toHaveTextContent("Turnout 74.3% · quorum 33.4% reached");
        expect(within(card).getByText("Connect a wallet with staked BZE to vote.")).toBeInTheDocument();
        expect(within(card).getByRole("link", { name: "View proposal" })).toHaveAttribute("href", "/governance/48");
        expect(screen.getByText("Connect your wallet to see your voting power and vote.")).toBeInTheDocument();
    });

    it("does not ask a connected wallet to connect", () => {
        connect(voterOf());
        useGovernanceMock.mockReturnValue(governance());
        renderPage();

        expect(useVoterMock).toHaveBeenCalledWith(ME, ["48"]);
        expect(screen.queryByText("Connect a wallet with staked BZE to vote.")).not.toBeInTheDocument();
        expect(screen.queryByText("Connect your wallet to see your voting power and vote.")).not.toBeInTheDocument();
    });

    it("shows the wallet's voting power", () => {
        connect(voterOf({ inactive: "820000000" }));
        useGovernanceMock.mockReturnValue(governance());
        renderPage();

        const card = screen.getByTestId("voting-power");
        expect(card).toHaveTextContent("Your voting power25,400 BZEStaked with 2 validators");
        expect(card).toHaveTextContent("820 BZE with inactive validators doesn't count.");
        expect(within(card).queryByRole("link")).not.toBeInTheDocument();
    });

    it("tells a wallet that hasn't voted what its validators did", () => {
        connect(voterOf());
        useGovernanceMock.mockReturnValue(governance());
        renderPage();

        const vote = screen.getByTestId("card-vote");
        expect(vote).toHaveTextContent("You haven't voted yet");
        expect(vote).toHaveTextContent("Meanwhile: Hive Node voted Yes, Comb Staking hasn't voted.");
        expect(within(vote).getByRole("button", { name: "Vote" })).toBeInTheDocument();
    });

    it("shows a wallet's vote with Change vote", () => {
        connect(voterOf({ vote: YES }));
        useGovernanceMock.mockReturnValue(governance());
        renderPage();

        const vote = screen.getByTestId("card-vote");
        expect(vote).toHaveTextContent("Counts for your 25,400 BZE. You can change it until voting ends.");
        expect(vote).toHaveTextContent("You voted Yes");
        expect(within(vote).getByRole("button", { name: "Change vote" })).toBeInTheDocument();
    });

    it("shows a split vote made elsewhere", () => {
        connect(voterOf({ vote: SPLIT }));
        useGovernanceMock.mockReturnValue(governance());
        renderPage();

        expect(screen.getByTestId("card-vote")).toHaveTextContent("You split your vote: Yes 60%, No 40%");
    });

    it("tells a wallet without stake its vote only counts once staked", () => {
        connect(voterOf({ validators: [] }));
        useGovernanceMock.mockReturnValue(governance());
        renderPage();

        const power = screen.getByTestId("voting-power");
        expect(power).toHaveTextContent("0 BZEYou have no BZE staked.");
        expect(within(power).getByRole("link", { name: "Stake BZE to get voting power →" })).toHaveAttribute("href", "/");
        const vote = screen.getByTestId("card-vote");
        expect(vote).toHaveTextContent("0 voting power");
        expect(vote).toHaveTextContent("You can vote, but it only counts once you have BZE staked.");
        expect(within(vote).getByRole("link", { name: "View proposal" })).toHaveAttribute("href", "/governance/48");
    });

    it("votes from a card, then re-reads the vote and the tallies", async () => {
        const refresh = connect(voterOf());
        const refreshTallies = vi.fn();
        useGovernanceMock.mockReturnValue(governance({ refreshTallies }));
        txMock.mockResolvedValue(true);
        renderPage();

        await userEvent.click(within(screen.getByTestId("card-vote")).getByRole("button", { name: "Vote" }));
        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveTextContent("#48 · Upgrade network to v8.2.0");
        await userEvent.click(within(dialog).getByRole("radio", { name: /^Yes/ }));
        await userEvent.click(within(dialog).getByRole("button", { name: "Continue" }));
        await act(() => userEvent.click(within(dialog).getByRole("button", { name: "Sign and vote" })));

        expect(txMock.mock.calls[0][0][0].value).toMatchObject({ proposalId: BigInt(48), voter: ME, option: 1 });
        expect(refresh).toHaveBeenCalledWith("48");
        expect(refreshTallies).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("lists the finished proposals with result, end date and Yes share", () => {
        useGovernanceMock.mockReturnValue(governance());
        renderPage();

        const passed = screen.getByRole("link", { name: /Upgrade network to v8\.1\.1/ });
        expect(passed).toHaveAttribute("href", "/governance/47");
        expect(passed).toHaveTextContent("Passed");
        expect(passed).toHaveTextContent("Jul 21, 2026");
        expect(passed).toHaveTextContent("Yes 90%");

        const rejected = screen.getByRole("link", { name: /Fund Liquidity Pools/ });
        expect(rejected).toHaveTextContent("Rejected");
        expect(rejected).toHaveTextContent("Community pool spend");
        expect(rejected).toHaveTextContent("No votes");

        expect(screen.getAllByRole("link", { name: /Full history on BZE Scan/ })[0])
            .toHaveAttribute("href", "https://explorer.getbze.com/proposals");
    });

    it("loads older proposals while there are more", async () => {
        const loadOlder = vi.fn();
        useGovernanceMock.mockReturnValue(governance({ hasOlder: true, loadOlder }));
        renderPage();

        await userEvent.click(screen.getByRole("button", { name: "Show older proposals" }));
        expect(loadOlder).toHaveBeenCalledTimes(1);
    });

    it("hides Show older on the last page", () => {
        useGovernanceMock.mockReturnValue(governance({ hasOlder: false }));
        renderPage();

        expect(screen.queryByRole("button", { name: "Show older proposals" })).not.toBeInTheDocument();
    });

    it("writes the rules from the chain's params", () => {
        useGovernanceMock.mockReturnValue(governance());
        const { unmount } = renderPage();
        expect(screen.getByTestId("governance-rules")).toHaveTextContent(
            "Voting lasts 5 days. To pass, at least 33.4% of staked BZE must vote, Yes must win more than 50% of the votes that aren't Abstain, and No with veto must stay at or below 33.4% of all votes."
        );
        unmount();

        useGovernanceMock.mockReturnValue(governance({}, {
            params: { ...PARAMS, quorum: "0.4", threshold: "0.6", veto_threshold: "0.25", voting_period: "7200s" },
        }));
        renderPage();
        expect(screen.getByTestId("governance-rules")).toHaveTextContent(
            "Voting lasts 2 hours. To pass, at least 40% of staked BZE must vote, Yes must win more than 60% of the votes that aren't Abstain, and No with veto must stay at or below 25% of all votes."
        );
        // The open card's quorum follows the params too.
        expect(screen.getByRole("article")).toHaveTextContent("quorum 40%");
    });
});
