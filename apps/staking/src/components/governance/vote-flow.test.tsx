import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type { GovParams, GovProposal, GovVote } from "@bze/bze-ui-kit";
import proposal48 from "@/lib/governance/fixtures/proposal-48.json";

// The vote flow with useSDKTx, the toast, the fee estimate and the wallet
// mocked; the message composer and the governance lib stay real.
const { txMock, toastSuccess, invalidateMock } = vi.hoisted(() => ({ txMock: vi.fn(), toastSuccess: vi.fn(), invalidateMock: vi.fn() }));

vi.mock("@interchain-kit/react", () => ({
    useChain: () => ({ address: "bze1me" }),
}));
vi.mock("@/hooks/useOpenProposalsSummary", () => ({
    invalidateOpenProposalsSummary: invalidateMock,
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    useSDKTx: () => ({ tx: txMock, progressTrack: "" }),
    useToast: () => ({ toast: { success: toastSuccess, error: vi.fn() } }),
    useGasFeeEstimate: () => ({ displayAmount: new BigNumber("0.0045"), ticker: "BZE", isLoading: false }),
}));

import { VoteFlow, type VoteFlowProps } from "./vote-flow";

const PARAMS = { veto_threshold: "0.334000000000000000", burn_vote_veto: true } as GovParams;
const PROPOSAL = proposal48 as GovProposal;
const YES: GovVote = { proposal_id: "48", voter: "bze1me", metadata: "", options: [{ option: "VOTE_OPTION_YES", weight: "1.000000000000000000" }] };

function renderFlow(props: Partial<VoteFlowProps> = {}) {
    const handlers = { onClose: vi.fn(), onVoted: vi.fn(), onEnded: vi.fn() };
    render(
        <ChakraProvider value={defaultSystem}>
            <VoteFlow proposal={PROPOSAL} params={PARAMS} power={new BigNumber("25400000000")} currentVote={null} {...handlers} {...props} />
        </ChakraProvider>
    );
    return handlers;
}

const dialog = () => screen.getByRole("dialog");

beforeEach(() => {
    txMock.mockReset();
    toastSuccess.mockReset();
    invalidateMock.mockReset();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("VoteFlow", () => {
    it("chooses, confirms, signs and sends one MsgVote, then toasts and closes", async () => {
        let finish: (ok: boolean) => void = () => {};
        txMock.mockImplementation(() => new Promise<boolean>((resolve) => { finish = resolve; }));
        const { onClose, onVoted } = renderFlow();

        expect(within(dialog()).getByText("Vote on this proposal")).toBeInTheDocument();
        expect(dialog()).toHaveTextContent("Your vote counts for25,400 BZE");
        expect(dialog()).toHaveTextContent("Your vote replaces your validators' votes for your stake. Single choice only.");
        expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

        await userEvent.click(screen.getByRole("radio", { name: /^No I'm against it/ }));
        await userEvent.click(screen.getByRole("button", { name: "Continue" }));

        const confirm = screen.getByTestId("vote-confirm");
        expect(dialog()).toHaveTextContent("You're votingNo");
        expect(confirm).toHaveTextContent("Voting power25,400 BZE");
        expect(confirm).toHaveTextContent("ReplacesYour validators’ votes for your stake");
        expect(confirm).toHaveTextContent("Network fee≈ 0.0045 BZE");
        expect(screen.queryByTestId("veto-warning")).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "Sign and vote" }));
        expect(dialog()).toHaveTextContent("Approve in your wallet");
        expect(screen.getByRole("button", { name: "Signing…" })).toBeDisabled();

        const [msgs] = txMock.mock.calls[0];
        expect(msgs).toHaveLength(1);
        expect(msgs[0].typeUrl).toBe("/cosmos.gov.v1.MsgVote");
        expect(msgs[0].value).toEqual({ proposalId: BigInt(48), voter: "bze1me", option: 3, metadata: "" });

        await act(async () => finish(true));
        expect(toastSuccess).toHaveBeenCalledWith("Vote recorded", "You voted No on #48. You can change it until Oct 20, 2026, 10:13 UTC.");
        expect(onVoted).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
        // The nav badge and the dashboard banner re-read the summary.
        expect(invalidateMock).toHaveBeenCalledTimes(1);
    });

    it("marks the current vote and says what the new one replaces", async () => {
        renderFlow({ currentVote: YES });

        expect(dialog()).toHaveTextContent("Your current vote is Yes. Voting again replaces it.");
        expect(screen.getByRole("radio", { name: /^Yes\s*Current/ })).toBeInTheDocument();
        await userEvent.click(screen.getByRole("radio", { name: /^Abstain/ }));
        await userEvent.click(screen.getByRole("button", { name: "Continue" }));
        expect(screen.getByTestId("vote-confirm")).toHaveTextContent("ReplacesYour current vote: Yes");
    });

    it("says a split vote is replaced by one choice", () => {
        renderFlow({
            currentVote: { ...YES, options: [{ option: "VOTE_OPTION_YES", weight: "0.6" }, { option: "VOTE_OPTION_NO", weight: "0.4" }] },
        });
        expect(dialog()).toHaveTextContent("You split your vote: Yes 60%, No 40%. Voting here replaces it with one choice.");
    });

    it("shows the inline error and Try again when the vote fails, and the wallet wording for a rejection", async () => {
        txMock.mockImplementation(async (_msgs, opts) => { opts.onFailure("insufficient fees"); return false; });
        const { onClose, onVoted } = renderFlow({ initialChoice: "yes" });

        await userEvent.click(screen.getByRole("button", { name: "Sign and vote" }));
        const alert = screen.getByRole("alert");
        expect(alert).toHaveTextContent("Your vote wasn't sent. insufficient fees");
        expect(onClose).not.toHaveBeenCalled();
        expect(onVoted).not.toHaveBeenCalled();
        expect(invalidateMock).not.toHaveBeenCalled();

        txMock.mockImplementation(async (_msgs, opts) => { opts.onFailure("Request rejected"); return false; });
        await userEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(txMock).toHaveBeenCalledTimes(2);
        expect(screen.getByRole("alert")).toHaveTextContent(
            "Your vote wasn't sent. The request was rejected in your wallet. Nothing changed, so you can try again."
        );
    });

    it("reloads the proposal when voting ended under the dialog", async () => {
        txMock.mockImplementation(async (_msgs, opts) => { opts.onFailure("48: inactive proposal"); return false; });
        const { onEnded } = renderFlow({ initialChoice: "yes" });

        await userEvent.click(screen.getByRole("button", { name: "Sign and vote" }));
        expect(onEnded).toHaveBeenCalledTimes(1);
    });

    it("warns about the veto only for No with veto, burning the deposit only with burn_vote_veto", async () => {
        renderFlow({ initialChoice: "no_with_veto" });
        expect(screen.getByTestId("veto-warning")).toHaveTextContent(
            "If more than 33.4% of all votes are No with veto, the proposal fails and the proposer's 100,000 BZE deposit is burned."
        );
        await userEvent.click(screen.getByRole("button", { name: "Back" }));
        await userEvent.click(screen.getByRole("radio", { name: /^Yes/ }));
        await userEvent.click(screen.getByRole("button", { name: "Continue" }));
        expect(screen.queryByTestId("veto-warning")).not.toBeInTheDocument();
    });

    it("leaves the burn out without burn_vote_veto", () => {
        renderFlow({ initialChoice: "no_with_veto", params: { ...PARAMS, burn_vote_veto: false } });
        const warning = screen.getByTestId("veto-warning");
        expect(warning).toHaveTextContent("the proposal fails.");
        expect(warning).not.toHaveTextContent("burned");
    });

    it("is a bottom sheet on a phone", async () => {
        vi.stubGlobal("matchMedia", (query: string) => ({
            matches: query.includes("max-width"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
        }));
        txMock.mockImplementation(() => new Promise<boolean>(() => {}));
        renderFlow({ initialChoice: "yes" });

        await userEvent.click(screen.getByRole("button", { name: "Sign and vote" }));
        expect(dialog()).toHaveTextContent("Confirm the Yes vote in your wallet app. Nothing is sent until you approve.");
    });
});
