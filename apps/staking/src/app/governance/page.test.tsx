import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { WalletState } from "@interchain-kit/core";
import type { GovParams, GovProposal, GovTally } from "@bze/bze-ui-kit";

// The page renders off useGovernance and the wallet status; both are mocked,
// as is the wallet sidebar (it needs the wallet providers). The ui-kit helpers
// and the governance lib stay real.
const { useGovernanceMock, useChainMock } = vi.hoisted(() => ({
    useGovernanceMock: vi.fn(),
    useChainMock: vi.fn(),
}));

vi.mock("@/hooks/useGovernance", () => ({
    useGovernance: () => useGovernanceMock(),
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

beforeEach(() => {
    useGovernanceMock.mockReset();
    useChainMock.mockReset();
    useChainMock.mockReturnValue({ status: WalletState.Disconnected });
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
        useChainMock.mockReturnValue({ status: WalletState.Connected });
        useGovernanceMock.mockReturnValue(governance());
        renderPage();

        expect(screen.queryByText("Connect a wallet with staked BZE to vote.")).not.toBeInTheDocument();
        expect(screen.queryByText("Connect your wallet to see your voting power and vote.")).not.toBeInTheDocument();
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
            "A vote lasts 5 days. A proposal passes when at least 33.4% of staked BZE votes, more than 50% of Yes / No / Veto votes are Yes, and less than 33.4% of all votes are No with veto."
        );
        unmount();

        useGovernanceMock.mockReturnValue(governance({}, {
            params: { ...PARAMS, quorum: "0.4", threshold: "0.6", veto_threshold: "0.25", voting_period: "7200s" },
        }));
        renderPage();
        expect(screen.getByTestId("governance-rules")).toHaveTextContent(
            "A vote lasts 2 hours. A proposal passes when at least 40% of staked BZE votes, more than 60% of Yes / No / Veto votes are Yes, and less than 25% of all votes are No with veto."
        );
        // The open card's quorum follows the params too.
        expect(screen.getByRole("article")).toHaveTextContent("quorum 40%");
    });
});
