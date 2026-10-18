import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { WalletState } from "@interchain-kit/core";
import BigNumber from "bignumber.js";
import type { GovParams, GovProposal, GovTally } from "@bze/bze-ui-kit";
import type { ProposalVoter } from "@/hooks/useVoter";
import proposal45 from "@/lib/governance/fixtures/proposal-45.json";
import proposal48 from "@/lib/governance/fixtures/proposal-48.json";
import { ME, SPLIT, YES, voterOf } from "@/lib/governance/fixtures/voter";

// The page renders off useProposal, useVoter, the route id and the wallet
// status; all are mocked, as are the wallet sidebar, the assets context, the
// logos and the tx hook (they need their providers or the network). The ui-kit
// helpers and the governance lib stay real.
const { useProposalMock, useVoterMock, useChainMock, paramsMock, txMock } = vi.hoisted(() => ({
    useProposalMock: vi.fn(),
    useVoterMock: vi.fn(),
    useChainMock: vi.fn(),
    paramsMock: vi.fn(),
    txMock: vi.fn(),
}));

vi.mock("@/hooks/useProposal", () => ({
    useProposal: (id: string) => useProposalMock(id),
}));
vi.mock("@/hooks/useVoter", () => ({
    useVoter: (address: string | undefined, ids: string[]) => useVoterMock(address, ids),
}));
vi.mock("@/hooks/useNow", () => ({
    useNow: () => new Date("2026-10-17T12:00:00Z"),
}));
vi.mock("next/navigation", () => ({
    useParams: () => paramsMock(),
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
        useAssets: () => ({ getAsset: () => undefined }),
        useValidatorLogos: () => ({ logos: {} }),
        useSDKTx: () => ({ tx: txMock, progressTrack: "" }),
        useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }),
        useGasFeeEstimate: () => ({ displayAmount: new BigNumber("0.0045"), ticker: "BZE", isLoading: false }),
    };
});

import ProposalPage from "./page";

const PARAMS = {
    quorum: "0.334000000000000000",
    threshold: "0.500000000000000000",
    veto_threshold: "0.334000000000000000",
    expedited_threshold: "0.667000000000000000",
    voting_period: "432000s",
    burn_vote_veto: true,
    burn_vote_quorum: false,
} as GovParams;

const OPEN = proposal48 as GovProposal;
const PASSED = proposal45 as GovProposal;

const tally = (yes: string, no = "0", veto = "0", abstain = "0"): GovTally => ({
    yes_count: yes, no_count: no, no_with_veto_count: veto, abstain_count: abstain,
});

function state(overrides: Record<string, unknown> = {}, data: Record<string, unknown> = {}) {
    return {
        data: {
            proposal: OPEN,
            params: PARAMS,
            bondedTokens: "152800000000000",
            tally: tally("113492783744251"),
            ...data,
        },
        isLoading: false,
        notFound: false,
        error: undefined,
        reload: vi.fn(),
        refreshTally: vi.fn(),
        ...overrides,
    };
}

function connect(voter?: ProposalVoter, refresh = vi.fn()) {
    useChainMock.mockReturnValue({ status: WalletState.Connected, address: ME });
    useVoterMock.mockReturnValue({ voterFor: () => voter, power: voter?.power, isLoading: false, failed: false, refresh });
    return refresh;
}

function renderPage(id = "48") {
    paramsMock.mockReturnValue({ id });
    return render(<ProposalPage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

beforeEach(() => {
    useProposalMock.mockReset();
    useChainMock.mockReset();
    useVoterMock.mockReset();
    txMock.mockReset();
    useChainMock.mockReturnValue({ status: WalletState.Disconnected });
    useVoterMock.mockReturnValue({ voterFor: () => undefined, power: undefined, isLoading: false, failed: false, refresh: vi.fn() });
});

describe("Proposal page", () => {
    it("shows skeletons while loading", () => {
        useProposalMock.mockReturnValue(state({ isLoading: true, data: undefined }));
        renderPage();

        expect(screen.getByLabelText("Loading proposal")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /All proposals/ })).toHaveAttribute("href", "/governance");
    });

    it("shows not found for a missing or deposit-period proposal", () => {
        useProposalMock.mockReturnValue(state({ notFound: true, data: undefined }));
        renderPage("49");

        const alert = screen.getByRole("alert");
        expect(within(alert).getByText("Proposal #49 not found")).toBeInTheDocument();
        expect(within(alert).queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
        expect(useProposalMock).toHaveBeenCalledWith("49");
    });

    it("shows the error state, and Try again reloads", async () => {
        const reload = vi.fn();
        useProposalMock.mockReturnValue(state({ error: new Error("down"), data: undefined, reload }));
        renderPage();

        const alert = screen.getByRole("alert");
        expect(within(alert).getByText("We couldn't load proposal #48")).toBeInTheDocument();
        await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it("renders an open upgrade proposal for a visitor", () => {
        useProposalMock.mockReturnValue(state());
        renderPage();

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Upgrade network to v8.2.0");
        expect(screen.getByText("#48")).toBeInTheDocument();
        expect(screen.getByText("Voting")).toBeInTheDocument();
        expect(screen.getByText("Voting ends in 2 days 22 hours · Oct 20, 2026, 10:13 UTC")).toBeInTheDocument();
        expect(screen.getAllByRole("link", { name: /View on BZE Scan/ })[0])
            .toHaveAttribute("href", "https://explorer.getbze.com/proposals/48");

        const action = screen.getByTestId("action");
        expect(action).toHaveTextContent(
            "Upgrades the BeeZee software to v8.2.0 at block 25,263,600. Validators switch to the new version at that block"
        );
        expect(within(action).getByRole("link", { name: /Upgrade countdown on BZE Scan/ }))
            .toHaveAttribute("href", "https://explorer.getbze.com/proposals/48");

        const vote = screen.getByRole("region", { name: "Your vote" });
        expect(vote).toHaveTextContent("Connect a wallet to vote. Your voting power is the BZE you have staked.");
        expect(within(vote).getAllByRole("button", { name: /Connect Wallet/ })).toHaveLength(1);

        const tallyPanel = screen.getByRole("region", { name: "Current tally" });
        expect(tallyPanel).toHaveTextContent("Live");
        expect(within(tallyPanel).getByRole("img", { name: "Turnout 74.3%, quorum line at 33.4%" })).toBeInTheDocument();
        expect(tallyPanel).toHaveTextContent("of 152.8M staked BZE");
        expect(within(tallyPanel).getByTestId("tally-rows")).toHaveTextContent("Yes113,492,784 BZE · 100%");
        const result = within(tallyPanel).getByTestId("tally-result");
        expect(result).toHaveTextContent("Passing if voting ended now");
        expect(result).toHaveTextContent("Quorum 74.3% voted, needs 33.4%");
        expect(result).toHaveTextContent("Yes 100% of Yes, No and veto votes, needs more than 50%");
        expect(result).toHaveTextContent("Veto 0% of all votes, fails above 33.4%");

        const timeline = screen.getByTestId("timeline");
        expect(timeline).toHaveTextContent("Voting now2 days 22 hours left");
        expect(screen.getByTestId("deposit")).toHaveTextContent("100,000 BZE · returned unless vetoed");
        expect(screen.getByRole("link", { name: "bze1dt…zfx4f" }))
            .toHaveAttribute("href", "https://explorer.getbze.com/accounts/bze1dte8cgjyxnsg4zmrlhfv4h4hnxv5vy8khzfx4f");
    });

    it("asks the voter for nothing without a wallet", () => {
        useProposalMock.mockReturnValue(state());
        renderPage();

        expect(useVoterMock).toHaveBeenCalledWith(undefined, ["48"]);
        expect(screen.queryByRole("region", { name: "Your validators' votes" })).not.toBeInTheDocument();
    });

    it("shows a connected wallet that hasn't voted its power, the options and its validators' votes", () => {
        connect(voterOf());
        useProposalMock.mockReturnValue(state());
        renderPage();

        expect(useVoterMock).toHaveBeenCalledWith(ME, ["48"]);
        const panel = screen.getByRole("region", { name: "Your vote" });
        expect(panel).toHaveTextContent("Voting power 25,400 BZE");
        expect(panel).toHaveTextContent("You haven't voted yet. Pick an option:");
        expect(within(panel).getAllByRole("button").map((b) => b.textContent)).toEqual(["Yes", "No", "No with veto", "Abstain"]);

        const validators = screen.getByRole("region", { name: "Your validators' votes" });
        const rows = within(validators).getAllByRole("listitem");
        expect(rows[0]).toHaveTextContent("Hive Node15,000 BZE of yoursYes");
        expect(rows[1]).toHaveTextContent("Comb Staking10,400 BZE of yoursNot voted");
        expect(validators).toHaveTextContent("Your own vote replaces them for all 25,400 BZE.");
    });

    it("shows a connected wallet's vote with Change vote, its validators' votes replaced", () => {
        connect(voterOf({ vote: YES }));
        useProposalMock.mockReturnValue(state());
        renderPage();

        const panel = screen.getByRole("region", { name: "Your vote" });
        expect(panel).toHaveTextContent("You voted Yes");
        expect(panel).toHaveTextContent("You can change it until Oct 20, 2026, 10:13 UTC; your last vote is the one that counts.");
        expect(within(panel).getByRole("button", { name: "Change vote" })).toBeInTheDocument();
        expect(within(panel).queryByRole("button", { name: "No with veto" })).not.toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Your validators' votes" })).toHaveTextContent("Your vote replaces these for your stake.");
    });

    it("shows a split vote made elsewhere", () => {
        connect(voterOf({ vote: SPLIT }));
        useProposalMock.mockReturnValue(state());
        renderPage();

        const panel = screen.getByRole("region", { name: "Your vote" });
        expect(panel).toHaveTextContent("You split your vote: Yes 60%, No 40%");
        expect(panel).toHaveTextContent("Voting here replaces it with one choice");
    });

    it("lets a wallet without stake vote, saying it only counts once staked", () => {
        connect(voterOf({ validators: [] }));
        useProposalMock.mockReturnValue(state());
        renderPage();

        const panel = screen.getByRole("region", { name: "Your vote" });
        expect(panel).toHaveTextContent("Voting power 0 BZE");
        expect(panel).toHaveTextContent(
            "You have no BZE staked, so your vote has 0 voting power. Votes are counted with the BZE you have staked when voting ends: stake before Oct 20, 2026, 10:13 UTC and your vote counts."
        );
        expect(within(panel).getByRole("link", { name: "Stake BZE" })).toHaveAttribute("href", "/");
        expect(within(panel).getByRole("button", { name: "Yes" })).toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "Your validators' votes" })).not.toBeInTheDocument();
    });

    it("says stake with inactive validators doesn't count", () => {
        connect(voterOf({ inactive: "820000000" }));
        useProposalMock.mockReturnValue(state());
        renderPage();

        expect(screen.getByRole("region", { name: "Your vote" })).toHaveTextContent("820 BZE with inactive validators doesn't count.");
    });

    it("opens the flow on the picked option and, after the vote, re-reads the vote and the tally", async () => {
        const refresh = connect(voterOf());
        const refreshTally = vi.fn();
        useProposalMock.mockReturnValue(state({ refreshTally }));
        txMock.mockResolvedValue(true);
        renderPage();

        await userEvent.click(within(screen.getByRole("region", { name: "Your vote" })).getByRole("button", { name: "No with veto" }));
        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveTextContent("You're votingNo with veto");
        expect(within(dialog).getByTestId("veto-warning")).toBeInTheDocument();

        await act(() => userEvent.click(within(dialog).getByRole("button", { name: "Sign and vote" })));
        expect(txMock.mock.calls[0][0][0].value.option).toBe(4);
        expect(refresh).toHaveBeenCalledWith("48");
        expect(refreshTally).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("says when the live tally didn't load", () => {
        useProposalMock.mockReturnValue(state({}, { tally: null }));
        renderPage();

        expect(screen.getByRole("status")).toHaveTextContent("The live tally didn't load.");
        expect(screen.queryByTestId("tally-result")).not.toBeInTheDocument();
    });

    it("renders a finished community pool spend (#45)", () => {
        connect(voterOf());
        useProposalMock.mockReturnValue(state({}, { proposal: PASSED, tally: PASSED.final_tally_result }));
        renderPage("45");

        expect(useVoterMock).toHaveBeenCalledWith(ME, []);
        expect(screen.queryByRole("region", { name: "Your validators' votes" })).not.toBeInTheDocument();

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Fund Liquidity Pools");
        expect(screen.getByText("Voting ended Dec 13, 2025, 10:21 UTC")).toBeInTheDocument();
        expect(screen.getByTestId("action")).toHaveTextContent("Sends 3,000,000 BZE from the community pool to bze1jx…qdd55.");

        const vote = screen.getByRole("region", { name: "Your vote" });
        expect(vote).toHaveTextContent("Voting ended on Dec 13, 2025.");
        expect(vote).toHaveTextContent("BZE Scan keeps every vote.");
        expect(within(vote).getByRole("link", { name: /See all votes on BZE Scan/ }))
            .toHaveAttribute("href", "https://explorer.getbze.com/proposals/45");
        expect(within(vote).queryByRole("button")).not.toBeInTheDocument();

        const tallyPanel = screen.getByRole("region", { name: "Final tally" });
        expect(tallyPanel).not.toHaveTextContent("Live");
        expect(within(tallyPanel).queryByRole("img", { name: /Turnout/ })).not.toBeInTheDocument();
        const result = within(tallyPanel).getByTestId("tally-result");
        expect(result).toHaveTextContent("Passed");
        expect(result).not.toHaveTextContent("if voting ended now");
        expect(result).toHaveTextContent("Quorum reached (needed 33.4% of staked BZE)");
        expect(result).toHaveTextContent("Yes 100% of Yes, No and veto votes (needed more than 50%)");

        expect(screen.getByTestId("timeline")).toHaveTextContent("PassedMessages executed");
        expect(screen.getByTestId("deposit")).toHaveTextContent("100,000 BZE · returned");
    });

    it("shows a failed proposal's reason", () => {
        const failed = { ...PASSED, status: "PROPOSAL_STATUS_FAILED", failed_reason: "insufficient funds" } as GovProposal;
        useProposalMock.mockReturnValue(state({}, { proposal: failed, tally: failed.final_tally_result }));
        renderPage("45");

        expect(screen.getAllByText("Failed").length).toBeGreaterThan(0);
        expect(screen.getByTestId("failed-reason")).toHaveTextContent("insufficient funds");
    });

    it("words the veto footnote and the deposit after burn_vote_veto", () => {
        useProposalMock.mockReturnValue(state());
        const { unmount } = renderPage();
        expect(screen.getByTestId("tally-footnote")).toHaveTextContent("the proposal fails and its deposit is burned.");
        unmount();

        useProposalMock.mockReturnValue(state({}, { params: { ...PARAMS, burn_vote_veto: false } }));
        renderPage();
        expect(screen.getByTestId("tally-footnote")).toHaveTextContent("If No with veto goes above 33.4%, the proposal fails.");
        expect(screen.getByTestId("tally-footnote")).not.toHaveTextContent("burned");
        expect(screen.getByTestId("deposit")).toHaveTextContent("100,000 BZE · returned when voting ends");
    });

    it("shows the messages as JSON behind Show technical details", async () => {
        useProposalMock.mockReturnValue(state());
        renderPage();

        expect(screen.queryByTestId("raw-messages")).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /Show technical details/ }));
        expect(screen.getByTestId("raw-messages")).toHaveTextContent("\"@type\": \"/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade\"");
        expect(screen.getByRole("button", { name: /Hide technical details/ })).toHaveAttribute("aria-expanded", "true");
    });

    it("renders the summary as markdown, collapsing a long one", async () => {
        useProposalMock.mockReturnValue(state());
        renderPage();

        const description = screen.getByRole("region", { name: "Description" });
        expect(within(description).getByRole("heading", { name: /Highlights/ })).toBeInTheDocument();
        expect(within(description).getByTestId("markdown").parentElement).toHaveAttribute("data-collapsed", "true");
        await userEvent.click(within(description).getByRole("button", { name: /Show full description/ }));
        expect(within(description).getByTestId("markdown").parentElement).toHaveAttribute("data-collapsed", "false");
    });
});
