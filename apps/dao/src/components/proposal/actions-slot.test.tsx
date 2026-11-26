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

import {ProposalActionsSlot} from "./actions-slot";
import {modelFromChain} from "@/lib/proposal-model";
import type {ProposalDeps, ProposalPageData} from "@/lib/proposal-loader";
import {PROPOSAL, RESPONSE} from "@/test/proposal-fixtures";

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

function renderSlot(data: ProposalPageData, over: {wallet?: string | null; ballot?: DaoBallot | null; weight?: string | null; refresh?: () => Promise<"ok" | "gone" | "failed">; getProposal?: () => Promise<unknown>} = {}) {
    const refresh = over.refresh ?? vi.fn(async () => "ok" as const);
    const deps = {chain: {getProposal: over.getProposal ?? (async () => RESPONSE)}} as unknown as ProposalDeps;
    render(
        <ChakraProvider value={defaultSystem}>
            <ProposalActionsSlot
                deps={deps}
                data={data}
                wallet={over.wallet === undefined ? ME : over.wallet}
                nowMs={Date.parse("2026-11-26T12:00:00Z")}
                mine={{data: {ballot: over.ballot ?? null, eligibleWeight: over.weight === undefined ? "1" : over.weight}, error: undefined, loading: false}}
                formatWeight={(a) => `${a} votes`}
                formatCoin={(c) => `${c.amount} ${c.denom}`}
                refresh={refresh}
                fingerprint={() => "VOTING"}
                lookupTx={async () => "notfound"}
            />
        </ChakraProvider>,
    );
    return {refresh};
}

beforeEach(() => {
    txMock.mockReset();
    balance.amount = new BigNumber(1000);
    balance.loading = false;
});

describe("ProposalActionsSlot", () => {
    it("votes: picks an option, sends one MsgVote with the DAO sign options, re-reads the proposal and says so", async () => {
        txMock.mockImplementation(async (_msgs, o) => { o.onBroadcast("H1"); o.onSuccess({height: 5, txhash: "H1", code: 0}); return true; });
        const {refresh} = renderSlot(voting);

        expect(screen.getByTestId("vote-weight-note")).toHaveTextContent("Your vote counts 1 votes");
        await userEvent.click(screen.getByTestId("vote-option-no"));
        await userEvent.click(screen.getByTestId("vote-confirm"));

        const [msgs, options] = txMock.mock.calls[0];
        expect(msgs).toHaveLength(1);
        expect(msgs[0].typeUrl).toBe("/bze.dao.MsgVote");
        expect(options).toMatchObject({useDirectSign: true, abortOnSimulationError: true, toasts: false});
        await waitFor(() => expect(screen.getByTestId("action-sent")).toHaveTextContent("Your vote is recorded."));
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("tx-hash")).toHaveTextContent("H1");
    });

    it("a revote marks the current option, disables it and says it replaces the ballot", async () => {
        renderSlot(voting, {ballot: ballot("YES")});
        expect(screen.getByTestId("vote-option-yes")).toBeDisabled();
        expect(screen.getByTestId("vote-option-yes")).toHaveTextContent("(your vote)");
        await userEvent.click(screen.getByTestId("vote-option-abstain"));
        expect(screen.getByTestId("vote-confirm")).toHaveTextContent("Change vote to Abstain");
    });

    it("a wallet with no weight sees why and cannot vote", () => {
        renderSlot(voting, {weight: "0"});
        expect(screen.getByTestId("vote-disabled-reason")).toHaveTextContent("not a member");
        expect(screen.getByTestId("vote-option-yes")).toBeDisabled();
    });

    it("vote and settle names what is signed: the weight of the YES and two messages in one transaction", async () => {
        txMock.mockResolvedValue(false);
        const expedited = dataOf({...RESPONSE, proposal: {...PROPOSAL, expedited: true, yes: "690", no: "0", abstain: "0"}});
        renderSlot(expedited, {weight: "11"});
        const note = screen.getByTestId("vote-and-settle");
        expect(note).toHaveTextContent("One transaction with two messages");
        expect(note).toHaveTextContent("your vote (YES)");
        expect(note).toHaveTextContent("11 votes");
        expect(note).toHaveTextContent("actions run there");
        await userEvent.click(screen.getByTestId("vote-and-settle-button"));
        expect(txMock.mock.calls[0][0].map((m: {typeUrl: string}) => m.typeUrl)).toEqual(["/bze.dao.MsgVote", "/bze.dao.MsgSettleProposal"]);
    });

    it("settles a proposal whose voting ended, saying the outcome first", async () => {
        txMock.mockResolvedValue(false);
        renderSlot(ended, {weight: "0"});
        expect(screen.getByTestId("settle-outcome")).toHaveAttribute("data-outcome", "pass");
        await userEvent.click(screen.getByTestId("settle-button"));
        expect(txMock.mock.calls[0][0][0].typeUrl).toBe("/bze.dao.MsgSettleProposal");
    });

    it("shows the reason a failed simulation gave and offers the action again", async () => {
        txMock.mockImplementation(async (_msgs, o) => { o.onFailure("This expedited proposal can't settle early yet.", {stage: "prepare"}); return false; });
        renderSlot(ended);
        await userEvent.click(screen.getByTestId("settle-button"));
        await waitFor(() => expect(screen.getByTestId("action-error")).toHaveTextContent("can't settle early yet"));
        expect(screen.getByTestId("settle-button")).toBeEnabled();
    });

    it("after a confirmation timeout the actions are gone, the hash is shown, and nothing can be sent twice", async () => {
        txMock.mockImplementation(async (_msgs, o) => { o.onBroadcast("HT"); o.onFailure("slow", {stage: "timeout", txHash: "HT"}); return false; });
        renderSlot(ended);
        await userEvent.click(screen.getByTestId("settle-button"));
        await waitFor(() => expect(screen.getByTestId("action-unconfirmed")).toHaveTextContent("HT"));
        expect(screen.queryByTestId("settle-button")).not.toBeInTheDocument();
        expect(txMock).toHaveBeenCalledTimes(1);
    });

    it("a wallet without balance sees every action disabled with the reason", () => {
        balance.amount = new BigNumber(0);
        renderSlot(ended);
        expect(screen.getByTestId("settle-button")).toBeDisabled();
        expect(screen.getByTestId("actions-blocked")).toHaveTextContent("no balance to pay the network fee");
    });

    it("no wallet: asks to connect and enables nothing", () => {
        renderSlot(ended, {wallet: null});
        expect(screen.getByTestId("actions-blocked")).toHaveTextContent("Connect a wallet");
        expect(screen.getByTestId("settle-button")).toBeDisabled();
    });

    it("the proposer cancels after reading what happens to the deposit", async () => {
        txMock.mockResolvedValue(false);
        renderSlot(voting, {wallet: "bze1proposer", weight: "0"});
        await userEvent.click(screen.getByTestId("cancel-button"));
        expect(screen.getByTestId("cancel-notice")).toHaveTextContent("not refunded");
        expect(screen.getByTestId("cancel-notice")).toHaveTextContent("proposal cost is never refunded");
        await userEvent.click(screen.getByTestId("cancel-confirm-button"));
        expect(txMock.mock.calls[0][0][0].typeUrl).toBe("/bze.dao.MsgCancelProposal");
    });

    it("cleans a finished proposal up batch by batch until the chain no longer has it", async () => {
        txMock.mockImplementation(async (_msgs, o) => { o.onSuccess({height: 5, txhash: "HC", code: 0}); return true; });
        const reads = [{}, null];
        const {refresh} = renderSlot(finished, {getProposal: async () => reads.shift(), refresh: vi.fn(async () => "gone" as const)});
        await userEvent.click(screen.getByTestId("cleanup-button"));
        await waitFor(() => expect(screen.getByTestId("action-sent")).toHaveTextContent("Cleaned up in 2 batches."));
        expect(txMock).toHaveBeenCalledTimes(2);
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("offers no vote, settle or cancel on a finished proposal, and says Ledger cannot sign", () => {
        renderSlot(finished);
        expect(screen.queryByTestId("action-vote")).not.toBeInTheDocument();
        expect(screen.queryByTestId("action-settle")).not.toBeInTheDocument();
        expect(screen.getByTestId("ledger-note")).toHaveTextContent("Ledger");
    });
});
