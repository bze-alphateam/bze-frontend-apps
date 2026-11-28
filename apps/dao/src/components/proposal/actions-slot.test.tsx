import {beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type {DaoBallot, DaoParams} from "@bze/bze-ui-kit";

const txMock = vi.hoisted(() => vi.fn());
const balance = vi.hoisted(() => ({amount: undefined as unknown, loading: false}));

vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    useSDKTx: () => ({tx: txMock, progressTrack: ""}),
    useSettings: () => ({feeDenom: "ubze"}),
    useBalance: (denom: string) => ({balance: {denom, amount: balance.amount}, isLoading: balance.loading, hasAmount: () => true}),
}));

import {useProposalActions, type ProposalActionsInput} from "./actions-slot";
import {ProposalDialogs} from "./dialogs";
import {StateArea} from "./state-card";
import {YourVoteCard} from "./your-vote";
import {modelFromChain} from "@/lib/proposal-model";
import type {ProposalDeps, ProposalPageData} from "@/lib/proposal-loader";
import {PROPOSAL, RESPONSE, SCAN} from "@/test/proposal-fixtures";

const ME = "bze1me";
const PARAMS = {min_expedite_delay: "86400s", cleanup_batch_size: "100"} as DaoParams;
const ballot = (option: DaoBallot["option"]): DaoBallot => ({proposal_id: "7", voter: ME, option, weight: "1", shares: []});

const dataOf = (over: Parameters<typeof modelFromChain>[0]): ProposalPageData => ({
    model: modelFromChain(over, null, "Club", "DAO_TYPE_STATIC_LIST"),
    dao: {ok: true, value: null}, params: {ok: true, value: PARAMS}, scanDetail: null, scanFailed: false, weightDenom: null,
});

const voting = dataOf(RESPONSE);
const ended = dataOf({...RESPONSE, voting_ended: true});
const finished = dataOf({...RESPONSE, proposal: {...PROPOSAL, status: "REJECTED"}});

const formatWeight = (a: string) => `${a} votes`;

/** The page's three action parts on one flow, as the page wires them. */
function Harness({input, onConnect, effects}: {input: ProposalActionsInput; onConnect: () => void; effects: string[]}) {
    const actions = useProposalActions(input);
    const {model} = input.data;
    return (
        <>
            <StateArea actions={actions} model={model} nowMs={input.nowMs} formatCoin={(c) => `${c.amount} ${c.denom}`} />
            <YourVoteCard actions={actions} model={model} mine={input.mine} formatWeight={formatWeight} onConnect={onConnect} />
            <ProposalDialogs actions={actions} model={model} effects={effects} mine={input.mine} formatWeight={formatWeight} formatCoin={(c) => `${c.amount} ${c.denom}`} />
        </>
    );
}

function renderActions(data: ProposalPageData, over: {wallet?: string | null; ballot?: DaoBallot | null; weight?: string | null; refresh?: () => Promise<"ok" | "gone" | "failed">; getProposal?: () => Promise<unknown>; effects?: string[]} = {}) {
    const refresh = over.refresh ?? vi.fn(async () => "ok" as const);
    const onConnect = vi.fn();
    const deps = {chain: {getProposal: over.getProposal ?? (async () => RESPONSE)}} as unknown as ProposalDeps;
    const input: ProposalActionsInput = {
        deps,
        data,
        wallet: over.wallet === undefined ? ME : over.wallet,
        nowMs: Date.parse("2026-11-26T12:00:00Z"),
        mine: {data: {ballot: over.ballot ?? null, eligibleWeight: over.weight === undefined ? "1" : over.weight, notCounted: []}, error: undefined, loading: false},
        refresh,
        fingerprint: () => "VOTING",
        lookupTx: async () => "notfound",
    };
    render(
        <ChakraProvider value={defaultSystem}>
            <Harness input={input} onConnect={onConnect} effects={over.effects ?? []} />
        </ChakraProvider>,
    );
    return {refresh, onConnect};
}

beforeEach(() => {
    txMock.mockReset();
    balance.amount = new BigNumber(1000);
    balance.loading = false;
});

describe("the proposal's actions", () => {
    it("votes: an option on the card opens the dialog with it picked, one MsgVote is sent with the DAO sign options, the page is re-read", async () => {
        txMock.mockImplementation(async (_msgs, o) => { o.onBroadcast("H1"); o.onSuccess({height: 5, txhash: "H1", code: 0}); return true; });
        const {refresh} = renderActions(voting);

        expect(screen.getByTestId("not-voted")).toHaveTextContent("Not voted");
        expect(screen.getByTestId("vote-weight-note")).toHaveTextContent("Your vote counts for1 votes");
        await userEvent.click(screen.getByTestId("vote-option-no"));
        expect(screen.getByTestId("dialog-option-no")).toBeChecked();
        expect(screen.getByTestId("vote-confirm")).toHaveTextContent("Vote no");
        await userEvent.click(screen.getByTestId("vote-confirm"));

        const [msgs, options] = txMock.mock.calls[0];
        expect(msgs).toHaveLength(1);
        expect(msgs[0].typeUrl).toBe("/bze.dao.MsgVote");
        expect(options).toMatchObject({useDirectSign: true, abortOnSimulationError: true, toasts: false});
        // the transaction panel takes the dialog's place
        await waitFor(() => expect(screen.getByTestId("action-sent")).toHaveTextContent("Your vote is recorded."));
        expect(screen.queryByTestId("vote-confirm")).not.toBeInTheDocument();
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("tx-hash")).toHaveTextContent("H1");
    });

    it("phone width (I3): one 'Counts for' line and one Vote button that opens the sheet; the desktop options are the md-and-up part", async () => {
        renderActions(voting);
        const phone = screen.getByTestId("phone-weight");
        expect(phone).toHaveAttribute("data-viewport", "phone");
        expect(phone).toHaveTextContent("Counts for1 votes");
        expect(screen.getByTestId("vote-option-yes").closest("[data-viewport]")).toHaveAttribute("data-viewport", "desktop");
        await userEvent.click(screen.getByTestId("vote-open-phone"));
        expect(screen.getByTestId("dialog-vote")).toHaveTextContent("Vote on this proposal");
        // no option was picked on the card: the first one the wallet can choose is
        expect(screen.getByTestId("dialog-option-yes")).toBeChecked();
        expect(screen.getByTestId("vote-confirm")).toHaveTextContent("Vote yes");
    });

    it("a revote: the ballot on the card, Change vote, the current option disabled in the dialog and the replacement said", async () => {
        renderActions(voting, {ballot: ballot("YES")});
        expect(screen.getByTestId("my-ballot-pill")).toHaveTextContent("Voted yes");
        expect(screen.queryByTestId("vote-option-yes")).not.toBeInTheDocument();
        await userEvent.click(screen.getByTestId("change-vote"));
        expect(screen.getByTestId("dialog-option-yes")).toBeDisabled();
        expect(screen.getByTestId("revote-note")).toHaveTextContent("Your current vote is Yes. Voting again replaces it");
        expect(screen.getByTestId("vote-confirm")).toHaveTextContent("Change to No");
        await userEvent.click(screen.getByTestId("dialog-option-abstain"));
        expect(screen.getByTestId("vote-confirm")).toHaveTextContent("Change to Abstain");
    });

    it("a wallet with no weight on a member list is told only members vote, and gets no vote buttons", () => {
        renderActions(voting, {weight: "0"});
        expect(screen.getByTestId("vote-disabled-reason")).toHaveTextContent("Only members of Club vote. Anyone can still settle a proposal when it's ready.");
        expect(screen.queryByTestId("vote-option-yes")).not.toBeInTheDocument();
    });

    it("vote and settle: the bars as they will be with this yes, two messages in one transaction", async () => {
        txMock.mockResolvedValue(false);
        const expedited = dataOf({...RESPONSE, proposal: {...PROPOSAL, expedited: true, yes: "690", no: "0", abstain: "0"}});
        renderActions(expedited, {weight: "11", effects: ["bze1r9…n4ex becomes a member"]});
        expect(screen.getByTestId("vote-and-settle")).toHaveTextContent("it meets the expedite bars, so this proposal can pass right now");
        await userEvent.click(screen.getByTestId("vote-and-settle-button"));
        const dialog = screen.getByTestId("vote-and-settle-dialog");
        expect(dialog).toHaveTextContent("With your yes: 701 of 1000 members");
        expect(screen.getByTestId("vote-and-settle-note")).toHaveTextContent("One transaction does both: your vote (YES, counted at 11 votes), then the settle. The proposal passes and its action runs: bze1r9…n4ex becomes a member.");
        await userEvent.click(screen.getByTestId("vote-and-settle-confirm"));
        expect(txMock.mock.calls[0][0].map((m: {typeUrl: string}) => m.typeUrl)).toEqual(["/bze.dao.MsgVote", "/bze.dao.MsgSettleProposal"]);
    });

    it("settles a proposal whose voting ended from the state card, saying the outcome first", async () => {
        txMock.mockResolvedValue(false);
        renderActions(ended, {weight: "0"});
        expect(screen.getByTestId("settle-banner")).toHaveTextContent("Waiting to be settled");
        expect(screen.getByTestId("settle-button")).toHaveTextContent("Settle now");
        await userEvent.click(screen.getByTestId("settle-button"));
        expect(screen.getByTestId("settle-outcome")).toHaveAttribute("data-outcome", "pass");
        expect(screen.getByTestId("settle-outcome")).toHaveTextContent("It passes: 45 % turnout (needs 40 %), 75 % yes (needs more than 50 %).");
        await userEvent.click(screen.getByTestId("settle-confirm"));
        expect(txMock.mock.calls[0][0][0].typeUrl).toBe("/bze.dao.MsgSettleProposal");
    });

    it("retry: the last failure in the info tone, until the chain's retry deadline", async () => {
        const failed: ProposalPageData = {
            ...voting,
            model: modelFromChain(
                {...RESPONSE, retry_deadline: "1830000000", proposal: {...PROPOSAL, status: "EXECUTION_FAILED"}},
                {...SCAN, status: "execution_failed", executed: false, execution_error: "message failed"},
                "Club",
                "DAO_TYPE_STATIC_LIST",
            ),
        };
        renderActions(failed, {weight: "0"});
        expect(screen.getByTestId("status-note")).toHaveTextContent("Passed · execution failed");
        await userEvent.click(screen.getByTestId("settle-button"));
        expect(screen.getByTestId("dialog-settle")).toHaveTextContent("Retry the actions of #7");
        expect(screen.getByTestId("execution-error")).toHaveAttribute("data-tone", "info");
        expect(screen.getByTestId("execution-error")).toHaveTextContent("Last time: message failed.");
        expect(screen.getByTestId("settle-confirm")).toHaveTextContent("Retry now");
    });

    it("shows the reason a failed simulation gave, and after the dialog closes the action is offered again", async () => {
        txMock.mockImplementation(async (_msgs, o) => { o.onFailure("This expedited proposal can't settle early yet.", {stage: "prepare"}); return false; });
        renderActions(ended);
        await userEvent.click(screen.getByTestId("settle-button"));
        await userEvent.click(screen.getByTestId("settle-confirm"));
        await waitFor(() => expect(screen.getByTestId("action-error")).toHaveTextContent("can't settle early yet"));
        await userEvent.click(screen.getByRole("button", {name: "Close"}));
        await waitFor(() => expect(screen.queryByTestId("dialog-settle")).not.toBeInTheDocument());
        expect(screen.getByTestId("action-error")).toBeInTheDocument();
        expect(screen.getByTestId("settle-button")).toBeEnabled();
    });

    it("after a confirmation timeout the hash is shown, the actions are locked, and nothing can be sent twice", async () => {
        txMock.mockImplementation(async (_msgs, o) => { o.onBroadcast("HT"); o.onFailure("slow", {stage: "timeout", txHash: "HT"}); return false; });
        renderActions(ended);
        await userEvent.click(screen.getByTestId("settle-button"));
        await userEvent.click(screen.getByTestId("settle-confirm"));
        await waitFor(() => expect(screen.getByTestId("action-unconfirmed")).toHaveTextContent("HT"));
        expect(screen.queryByTestId("settle-confirm")).not.toBeInTheDocument();
        expect(screen.getByTestId("settle-button")).toBeDisabled();
        expect(txMock).toHaveBeenCalledTimes(1);
    });

    it("a wallet without balance sees why on the card and the settle disabled", () => {
        balance.amount = new BigNumber(0);
        renderActions(ended);
        expect(screen.getByTestId("settle-button")).toBeDisabled();
        expect(screen.getByTestId("settle-blocked")).toHaveTextContent("no balance to pay the network fee");
        renderActions(voting);
        expect(screen.getAllByTestId("actions-blocked").at(-1)).toHaveTextContent("You need a little BZE to pay the network fee.");
        expect(screen.getByTestId("vote-open")).toBeDisabled();
    });

    it("no wallet: Your vote asks to connect (the header's Connect), the settle is disabled with the reason", async () => {
        const {onConnect} = renderActions(voting, {wallet: null});
        expect(screen.getByTestId("actions-blocked")).toHaveTextContent("Connect a wallet to see your voting power and vote.");
        await userEvent.click(screen.getByTestId("your-vote-connect"));
        expect(onConnect).toHaveBeenCalledTimes(1);
        renderActions(ended, {wallet: null});
        expect(screen.getByTestId("settle-blocked")).toHaveTextContent("Connect a wallet");
        expect(screen.getByTestId("settle-button")).toBeDisabled();
    });

    it("the proposer cancels after reading what happens to the deposit", async () => {
        txMock.mockResolvedValue(false);
        renderActions(voting, {wallet: "bze1proposer", weight: "0"});
        await userEvent.click(screen.getByTestId("cancel-button"));
        expect(screen.getByTestId("cancel-notice")).toHaveTextContent("not refunded");
        expect(screen.getByTestId("cancel-notice")).toHaveTextContent("proposal cost is never refunded");
        await userEvent.click(screen.getByTestId("cancel-confirm-button"));
        expect(txMock.mock.calls[0][0][0].typeUrl).toBe("/bze.dao.MsgCancelProposal");
    });

    it("cleans a finished proposal up batch by batch until the chain no longer has it", async () => {
        txMock.mockImplementation(async (_msgs, o) => { o.onSuccess({height: 5, txhash: "HC", code: 0}); return true; });
        const reads = [{}, null];
        const {refresh} = renderActions(finished, {getProposal: async () => reads.shift(), refresh: vi.fn(async () => "gone" as const)});
        expect(screen.getByTestId("finished-note")).toHaveTextContent("Nothing ran.");
        await userEvent.click(screen.getByTestId("cleanup-button"));
        // the status in words, not the chain's enum
        expect(screen.getByTestId("dialog-cleanup")).toHaveTextContent("Finished · rejected");
        expect(screen.getByTestId("dialog-cleanup")).not.toHaveTextContent("REJECTED");
        await userEvent.click(screen.getByTestId("cleanup-confirm"));
        await waitFor(() => expect(screen.getByTestId("action-sent")).toHaveTextContent("Cleaned up in 2 batches."));
        expect(txMock).toHaveBeenCalledTimes(2);
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("a finished proposal offers no vote or settle; while voting the card says a Ledger cannot sign", () => {
        renderActions(finished);
        expect(screen.queryByTestId("vote-option-yes")).not.toBeInTheDocument();
        expect(screen.queryByTestId("settle-button")).not.toBeInTheDocument();
        expect(screen.getByTestId("not-voted")).toHaveTextContent("You did not vote on this proposal.");
        renderActions(voting);
        expect(screen.getByTestId("ledger-note")).toHaveTextContent("Ledger");
    });
});
