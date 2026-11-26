import {beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type {Dao, DaoControllerResponse, TxLanding} from "@bze/bze-ui-kit";

const txMock = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    useSDKTx: () => ({tx: txMock, progressTrack: ""}),
    useToast: () => ({toast: vi.fn()}),
    useAssets: () => ({
        getAsset: (denom: string) => (denom === "ubze" ? {denom, decimals: 6} : undefined),
        denomTicker: (denom: string) => (denom === "ubze" ? "TBZE" : denom),
    }),
    useAssetsValue: () => ({denomUsdValue: () => new BigNumber(0)}),
}));
vi.mock("next/navigation", () => ({useRouter: () => ({push})}));

import {DAO, DAO_ADDRESS, OTHER, PARAMS, STAKE_DAO, THIRD, WALLET} from "@/test/composer-fixtures";
import type {NominationChain} from "@/lib/admin/nomination";
import type {DaoView} from "@/lib/dao-view-loader";
import type {Relations} from "@/lib/propose/relations";
import {Console} from "./console";

const full = (over: Partial<Dao> = {}): Dao => ({...DAO, created_at: "1790000000", admin_seq: "1", pending_admin_seq: "0", ...over}) as Dao;

const viewOf = (dao: Dao, over: Partial<DaoView> = {}): DaoView => ({
    dao,
    params: {ok: true, value: PARAMS},
    controller: {ok: true, value: null},
    knownDaos: new Map(),
    unresolved: new Set(),
    treasury: {ok: true, value: [{denom: "ubze", amount: "250000000"}]},
    openProposals: {ok: true, value: []},
    sources: {ok: true, value: []},
    ...over,
});

const noRelations: Relations = {subDaos: [], incoming: [], sources: []};
const controller = (path: string[]): DaoControllerResponse => ({controller: WALLET, end_reason: "ACCOUNT", path});
const chainOf = (over: Partial<NominationChain> = {}): NominationChain => ({
    getController: vi.fn(async () => controller([DAO_ADDRESS])),
    getDaoByAddress: vi.fn(async () => null),
    ...over,
});

function renderConsole(dao: Dao, over: {wallet?: string | null; relations?: Relations; chain?: NominationChain; lookupTx?: (hash: string) => Promise<TxLanding>; view?: Partial<DaoView>} = {}) {
    const refresh = vi.fn(async () => "ok" as const);
    render(
        <ChakraProvider value={defaultSystem}>
            <Console
                view={viewOf(dao, over.view)}
                relations={over.relations ?? noRelations}
                wallet={over.wallet === undefined ? WALLET : over.wallet}
                flowWallet={WALLET}
                nominationChain={over.chain ?? chainOf()}
                refresh={refresh}
                fingerprint={() => `${dao.admin}|${dao.pending_admin}`}
                lookupTx={over.lookupTx ?? (async () => "notfound")}
            />
        </ChakraProvider>,
    );
    return {refresh};
}

const landed = () => txMock.mockImplementation(async (_msgs, o) => { o.onBroadcast("H1"); o.onSuccess({height: 5, txhash: "H1", code: 0}); return true; });
const administered = full({admin: WALLET});

beforeEach(() => {
    txMock.mockReset();
    push.mockReset();
    window.localStorage.clear();
});

describe("who gets the console", () => {
    it("a stranger gets none, whatever the address says", () => {
        renderConsole(administered, {wallet: THIRD});
        expect(screen.getByTestId("no-console")).toBeInTheDocument();
        expect(screen.queryByTestId("execute-panel")).toBeNull();
        expect(screen.queryByTestId("nominate-panel")).toBeNull();
        expect(screen.queryByTestId("accept-console")).toBeNull();
    });

    it("the voters of a self-owned DAO have none: it has no admin", () => {
        renderConsole(full({admin: DAO_ADDRESS}), {wallet: DAO_ADDRESS});
        expect(screen.getByTestId("no-console")).toHaveTextContent("governed by its voters");
    });

    it("the admin sees every operation", () => {
        renderConsole(administered);
        expect(screen.getByTestId("admin-warning")).toHaveTextContent("spending the whole treasury");
        for (const id of ["execute-panel", "nominate-panel", "handover-panel"]) expect(screen.getByTestId(id)).toBeInTheDocument();
        // no nomination yet: nothing to withdraw
        expect(screen.queryByTestId("withdraw-panel")).toBeNull();
    });
});

describe("a wallet that disconnects", () => {
    it("takes the panels away but keeps what a failed signing said", async () => {
        txMock.mockImplementation(async (_msgs, o) => { o.onFailure("Can not find suitable signing client.", {stage: "prepare"}); return false; });
        const view = viewOf(administered);
        const props = {view, relations: noRelations, flowWallet: WALLET, nominationChain: chainOf(), refresh: async () => "ok" as const, fingerprint: () => "x", lookupTx: async (): Promise<TxLanding> => "notfound"};
        const {rerender} = render(<ChakraProvider value={defaultSystem}><Console {...props} wallet={WALLET} /></ChakraProvider>);
        await userEvent.click(screen.getByTestId("handover-understood"));
        fireEvent.change(screen.getByTestId("handover-confirm"), {target: {value: "Founders"}});
        await userEvent.click(screen.getByTestId("handover-submit"));
        await waitFor(() => expect(screen.getByTestId("action-error")).toBeInTheDocument());

        rerender(<ChakraProvider value={defaultSystem}><Console {...props} wallet={null} /></ChakraProvider>);
        expect(screen.getByTestId("action-error")).toHaveTextContent("Can not find suitable signing client.");
        expect(screen.getByTestId("admin-needs-wallet")).toBeInTheDocument();
        expect(screen.queryByTestId("execute-panel")).toBeNull();
    });
});

describe("run actions as the DAO", () => {
    it("pays from the treasury: reviewed in full, then one MsgAdminExecute signed by the wallet, and back to the DAO page", async () => {
        landed();
        const {refresh} = renderConsole(administered);
        await userEvent.click(screen.getByTestId("add-action"));
        await userEvent.click(screen.getByTestId("add-pay"));
        expect(screen.getByTestId("execute-submit")).toBeDisabled();

        fireEvent.change(screen.getByTestId("pay-to"), {target: {value: OTHER}});
        fireEvent.change(screen.getByTestId("pay-amount"), {target: {value: "12.5"}});

        const review = screen.getByTestId("execute-review");
        expect(review).toHaveTextContent("Send 12.5 TBZE from the DAO");
        expect(review).toHaveTextContent("Every message is signed by the DAO account");
        expect(screen.getByTestId("execute-outer")).toHaveTextContent("MsgAdminExecute");
        expect(screen.getByTestId("execute-sign")).toHaveTextContent("Signed by your wallet");

        await userEvent.click(screen.getByTestId("execute-submit"));
        const [msgs, options] = txMock.mock.calls[0];
        expect(msgs).toHaveLength(1);
        expect(msgs[0].typeUrl).toBe("/bze.dao.MsgAdminExecute");
        expect(msgs[0].value).toMatchObject({admin: WALLET, daoId: 4n});
        expect(msgs[0].value.msgs).toHaveLength(1);
        expect(options).toMatchObject({useDirectSign: true, abortOnSimulationError: true, toasts: false});

        await waitFor(() => expect(push).toHaveBeenCalledWith("/dao/4"));
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("a payment above the treasury is refused before anything is signed", async () => {
        renderConsole(administered);
        await userEvent.click(screen.getByTestId("add-action"));
        await userEvent.click(screen.getByTestId("add-pay"));
        fireEvent.change(screen.getByTestId("pay-to"), {target: {value: OTHER}});
        fireEvent.change(screen.getByTestId("pay-amount"), {target: {value: "251"}});
        expect(screen.getByTestId("execute-submit")).toBeDisabled();
        expect(screen.getByTestId("execute-problem")).toHaveTextContent("holds less than this");
        expect(txMock).not.toHaveBeenCalled();
    });

    it("a custom message that only a proposal may carry is refused, and the grant types are not typable at all", async () => {
        renderConsole(administered);
        await userEvent.click(screen.getByTestId("add-action"));
        await userEvent.click(screen.getByTestId("add-custom"));
        fireEvent.change(screen.getByRole("textbox", {name: /json|message/i}), {target: {value: JSON.stringify({"@type": "/cosmos.authz.v1beta1.MsgExec", grantee: DAO_ADDRESS, msgs: []})}});
        expect(screen.getByTestId("execute-problem")).toHaveTextContent("error 1133");
        expect(screen.getByTestId("execute-submit")).toBeDisabled();
    });

    it("a simulation the chain refuses shows the reason and signs nothing; the console stays open", async () => {
        txMock.mockImplementation(async (_msgs, o) => { o.onFailure("Only this DAO's admin can do that. Connect the admin's wallet.", {stage: "prepare"}); return false; });
        renderConsole(administered);
        await userEvent.click(screen.getByTestId("add-action"));
        await userEvent.click(screen.getByTestId("add-pay"));
        fireEvent.change(screen.getByTestId("pay-to"), {target: {value: OTHER}});
        fireEvent.change(screen.getByTestId("pay-amount"), {target: {value: "1"}});
        await userEvent.click(screen.getByTestId("execute-submit"));

        await waitFor(() => expect(screen.getByTestId("action-error")).toHaveTextContent("Only this DAO's admin"));
        expect(push).not.toHaveBeenCalled();
        expect(screen.getByTestId("execute-submit")).toBeEnabled();
    });

    it("a confirmation timeout locks every operation until the node has been asked", async () => {
        txMock.mockImplementation(async (_msgs, o) => { o.onBroadcast("H9"); o.onFailure("slow", {stage: "timeout", txHash: "H9"}); return false; });
        renderConsole(administered, {lookupTx: async () => "landed"});
        await userEvent.click(screen.getByTestId("add-action"));
        await userEvent.click(screen.getByTestId("add-pay"));
        fireEvent.change(screen.getByTestId("pay-to"), {target: {value: OTHER}});
        fireEvent.change(screen.getByTestId("pay-amount"), {target: {value: "1"}});
        await userEvent.click(screen.getByTestId("execute-submit"));

        await waitFor(() => expect(screen.getByTestId("action-unconfirmed")).toBeInTheDocument());
        expect(screen.getByTestId("execute-submit")).toBeDisabled();
        expect(screen.getByTestId("nominate-submit")).toBeDisabled();
        expect(screen.getByTestId("handover-confirm")).toBeInTheDocument();

        await userEvent.click(screen.getByTestId("action-recheck"));
        await waitFor(() => expect(push).toHaveBeenCalledWith("/dao/4"));
        expect(txMock).toHaveBeenCalledTimes(1);
    });

    it("a payment the node has not seen yet stays locked, with a way out only the user can take", async () => {
        txMock.mockImplementation(async (_msgs, o) => { o.onBroadcast("H9"); o.onFailure("slow", {stage: "timeout", txHash: "H9"}); return false; });
        renderConsole(administered, {lookupTx: async () => "notfound"});
        await userEvent.click(screen.getByTestId("add-action"));
        await userEvent.click(screen.getByTestId("add-pay"));
        fireEvent.change(screen.getByTestId("pay-to"), {target: {value: OTHER}});
        fireEvent.change(screen.getByTestId("pay-amount"), {target: {value: "1"}});
        await userEvent.click(screen.getByTestId("execute-submit"));
        await waitFor(() => expect(screen.getByTestId("action-unconfirmed")).toBeInTheDocument());

        await userEvent.click(screen.getByTestId("action-recheck"));
        await waitFor(() => expect(screen.getByTestId("recheck-note")).toHaveTextContent("may still be included"));
        expect(screen.getByTestId("execute-submit")).toBeDisabled();

        await userEvent.click(screen.getByTestId("action-release"));
        await waitFor(() => expect(screen.getByTestId("execute-submit")).toBeEnabled());
        expect(txMock).toHaveBeenCalledTimes(1);
    });
});

describe("nominate, withdraw, hand over", () => {
    it("nominates: the nominee is checked, the message shown, and it is signed by the wallet as the admin", async () => {
        landed();
        renderConsole(administered);
        expect(screen.getByTestId("nominate-submit")).toBeDisabled();

        fireEvent.change(screen.getByTestId("nominee"), {target: {value: "cosmos1nope"}});
        expect(screen.getByTestId("nominate-problem")).toHaveTextContent("not a valid BeeZee address");
        fireEvent.change(screen.getByTestId("nominee"), {target: {value: WALLET}});
        expect(screen.getByTestId("nominate-problem")).toHaveTextContent("already the admin");
        fireEvent.change(screen.getByTestId("nominee"), {target: {value: DAO_ADDRESS}});
        expect(screen.getByTestId("nominate-problem")).toHaveTextContent("cannot be its own nominee");

        fireEvent.change(screen.getByTestId("nominee"), {target: {value: OTHER.toUpperCase()}});
        expect(screen.getByTestId("nominate-panel")).toHaveTextContent("Nominate a new admin for DAO 4 (they have to accept)");
        await userEvent.click(screen.getByTestId("nominate-submit"));

        const [msgs] = txMock.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.dao.MsgNominateAdmin");
        expect(msgs[0].value).toMatchObject({authority: WALLET, daoId: 4n, nominee: OTHER});
        await waitFor(() => expect(push).toHaveBeenCalledWith("/dao/4"));
    });

    it("with a nomination pending: it can be withdrawn, and neither a second nomination nor the handover is offered (1112)", async () => {
        landed();
        renderConsole(full({admin: WALLET, pending_admin: OTHER, pending_admin_seq: "2"}));
        expect(screen.getByTestId("nominate-pending")).toHaveTextContent("1112");
        expect(screen.queryByTestId("nominee")).toBeNull();
        expect(screen.getByTestId("handover-blocked")).toHaveTextContent("1112");
        expect(screen.queryByTestId("handover-submit")).toBeNull();

        await userEvent.click(screen.getByTestId("withdraw-submit"));
        const [msgs] = txMock.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.dao.MsgWithdrawAdminNomination");
        expect(msgs[0].value).toMatchObject({authority: WALLET, daoId: 4n});
    });

    it("hands the DAO to its voters only after the box is ticked and its name typed, with an empty nominee", async () => {
        landed();
        renderConsole(administered);
        expect(screen.getByTestId("handover-panel")).toHaveTextContent("you cannot undo it");
        expect(screen.getByTestId("handover-submit")).toBeDisabled();

        expect(screen.getByTestId("handover-voters")).toHaveTextContent("Its voters can vote: 2 members");
        // the name typed but the box not ticked, then the box ticked but a wrong name: neither is enough
        fireEvent.change(screen.getByTestId("handover-confirm"), {target: {value: "Founders"}});
        expect(screen.getByTestId("handover-submit")).toBeDisabled();
        await userEvent.click(screen.getByTestId("handover-understood"));
        fireEvent.change(screen.getByTestId("handover-confirm"), {target: {value: "Founder"}});
        expect(screen.getByTestId("handover-submit")).toBeDisabled();
        fireEvent.change(screen.getByTestId("handover-confirm"), {target: {value: " Founders "}});
        await userEvent.click(screen.getByTestId("handover-submit"));

        const [msgs] = txMock.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.dao.MsgNominateAdmin");
        expect(msgs[0].value).toMatchObject({authority: WALLET, daoId: 4n, nominee: ""});
        await waitFor(() => expect(push).toHaveBeenCalledWith("/dao/4"));
    });

    it("is blocked for a DAO with no voters", () => {
        renderConsole(full({admin: WALLET, members: []}));
        expect(screen.getByTestId("handover-blocked")).toHaveTextContent("no voters to hand it to");
        expect(screen.queryByTestId("handover-submit")).toBeNull();
    });

    it("a stake DAO whose sources could not be read cannot be handed over", () => {
        renderConsole(full({...STAKE_DAO, admin: WALLET} as Partial<Dao>), {relations: {...noRelations, sources: null}});
        expect(screen.getByTestId("handover-blocked")).toHaveTextContent("could not be read");
    });
});

describe("accept a nomination", () => {
    const nominated = full({admin: THIRD, pending_admin: WALLET, pending_admin_seq: "5", admin_seq: "5"});

    it("fresh: shows what the wallet takes over, then signs the acceptance as the nominee", async () => {
        landed();
        renderConsole(nominated);
        expect(screen.getByTestId("accept-panel")).toHaveTextContent("Founders nominated your wallet");
        expect(screen.getByTestId("treasury-panel")).toBeInTheDocument();
        expect(screen.getByTestId("rules-panel")).toBeInTheDocument();
        expect(screen.queryByTestId("execute-panel")).toBeNull();

        await userEvent.click(await screen.findByTestId("accept-submit"));
        const [msgs] = txMock.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.dao.MsgAcceptAdminNomination");
        expect(msgs[0].value).toMatchObject({nominee: WALLET, daoId: 4n});
        await waitFor(() => expect(push).toHaveBeenCalledWith("/dao/4"));
    });

    it("stale: says so instead of offering the button", async () => {
        const chain = chainOf({
            getController: vi.fn(async () => controller([DAO_ADDRESS, "bze1parent"])),
            getDaoByAddress: vi.fn(async () => full({id: "9", name: "Parent", address: "bze1parent", admin_seq: "6"})),
        });
        renderConsole(nominated, {chain});
        expect(await screen.findByTestId("accept-stale")).toHaveTextContent("This nomination is out of date; the current admin must withdraw it and nominate again.");
        expect(screen.queryByTestId("accept-submit")).toBeNull();
    });

    it("unreadable: no button, a way to check again", async () => {
        const getController = vi.fn(async () => { throw new Error("rest"); });
        renderConsole(nominated, {chain: chainOf({getController})});
        expect(await screen.findByTestId("accept-unreadable")).toBeInTheDocument();
        expect(screen.queryByTestId("accept-submit")).toBeNull();

        getController.mockImplementation(async () => controller([DAO_ADDRESS]) as never);
        await userEvent.click(screen.getByTestId("accept-retry"));
        expect(await screen.findByTestId("accept-submit")).toBeInTheDocument();
    });
});
