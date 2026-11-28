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
        for (const id of ["accept-checking", "accept-card", "stale-card", "accept-submit"]) expect(screen.queryByTestId(id)).toBeNull();
    });

    it("the voters of a self-owned DAO have none: it has no admin", () => {
        renderConsole(full({admin: DAO_ADDRESS}), {wallet: DAO_ADDRESS});
        expect(screen.getByTestId("no-console")).toHaveTextContent("governed by its voters");
    });

    it("the admin sees every operation", () => {
        renderConsole(administered);
        expect(screen.getByTestId("admin-hero-title")).toHaveTextContent("You are the admin of Founders");
        expect(screen.getByTestId("admin-warning")).toHaveTextContent("You can run any action as the DAO without a vote, and hand it over. Its 2 members vote on proposals as usual.");
        for (const id of ["execute-panel", "hand-over-card", "nominate-panel", "handover-panel"]) expect(screen.getByTestId(id)).toBeInTheDocument();
        // no nomination yet: nothing to withdraw
        expect(screen.queryByTestId("withdraw-panel")).toBeNull();
        // the board's order: run actions, hand over, hand to voters; no back link above them
        const ids = [...document.querySelectorAll("[data-testid=execute-panel], [data-testid=hand-over-card], [data-testid=handover-panel]")].map((e) => e.getAttribute("data-testid"));
        expect(ids).toEqual(["execute-panel", "hand-over-card", "handover-panel"]);
        expect(screen.queryByText("← Founders")).toBeNull();
    });

    it("the hero of a stake DAO names its stakers", () => {
        renderConsole(full({...STAKE_DAO, admin: WALLET} as Partial<Dao>));
        expect(screen.getByTestId("admin-warning")).toHaveTextContent("Its stakers vote on proposals as usual.");
        expect(screen.getByTestId("handover-text")).toHaveTextContent("only proposals its stakers vote on");
    });

    it("the admin's cards take the whole width: there is no This DAO side panel", () => {
        renderConsole(administered);
        expect(screen.queryByText("This DAO")).toBeNull();
        expect(screen.queryByTestId("this-dao-panel")).toBeNull();
        expect(screen.queryByTestId("treasury-panel")).toBeNull();
        expect(screen.queryByText(/^Pending/)).toBeNull();
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

        // the review is read back from the message that would be signed
        expect(screen.getByTestId("execute-review")).toHaveTextContent(/^Founders will: 1\. pay 12\.5 TBZE to bze1.{3}….{4}\. If it fails, nothing happens\.$/);
        expect(screen.getByTestId("size-text")).toHaveTextContent(/of 20,000 bytes · 1 of 16 actions$/);
        expect(screen.getByTestId("execute-panel")).toHaveTextContent("MsgAdminExecute · all or nothing");
        expect(screen.getByTestId("execute-submit")).toHaveTextContent("Run the action now");

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

    it("two actions: both numbered in the review, and the button counts them", async () => {
        renderConsole(administered);
        // no actions: no Review block yet
        expect(screen.queryByText("Review")).toBeNull();
        expect(screen.queryByTestId("execute-review")).toBeNull();
        expect(screen.getByTestId("execute-submit")).toHaveTextContent("Run now");
        for (const amount of ["1", "2"]) {
            await userEvent.click(screen.getByTestId("add-action"));
            await userEvent.click(screen.getByTestId("add-pay"));
            const to = screen.getAllByTestId("pay-to");
            fireEvent.change(to[to.length - 1], {target: {value: OTHER}});
            const amounts = screen.getAllByTestId("pay-amount");
            fireEvent.change(amounts[amounts.length - 1], {target: {value: amount}});
        }
        expect(screen.getByTestId("execute-review")).toHaveTextContent(/^Founders will: 1\. pay 1 TBZE to .+, 2\. pay 2 TBZE to .+\. If one fails, nothing happens\.$/);
        expect(screen.getByTestId("size-text")).toHaveTextContent("2 of 16 actions");
        expect(screen.getByTestId("execute-submit")).toHaveTextContent("Run 2 actions now");
        expect(screen.getByTestId("execute-submit")).toBeEnabled();
    });

    it("one finished and one unfinished action: no review sentence that would skip one, only the problem", async () => {
        renderConsole(administered);
        await userEvent.click(screen.getByTestId("add-action"));
        await userEvent.click(screen.getByTestId("add-pay"));
        fireEvent.change(screen.getByTestId("pay-to"), {target: {value: OTHER}});
        fireEvent.change(screen.getByTestId("pay-amount"), {target: {value: "1"}});
        expect(screen.getByTestId("execute-review")).toBeInTheDocument();
        await userEvent.click(screen.getByTestId("add-action"));
        await userEvent.click(screen.getByTestId("add-pay"));
        expect(screen.queryByTestId("execute-review")).toBeNull();
        expect(screen.getByTestId("execute-problem")).toBeInTheDocument();
        expect(screen.getByTestId("execute-submit")).toBeDisabled();
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
        expect(screen.queryByTestId("nominate-problem")).toBeNull();
        expect(screen.getByTestId("nominate-panel")).toHaveTextContent("A person or a DAO. You stay admin until they accept.");
        expect(screen.getByTestId("nominate-submit")).toBeEnabled();
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
        expect(screen.getByTestId("withdraw-panel")).toHaveTextContent("Pending");
        expect(screen.getByTestId("withdraw-nominee")).toHaveTextContent(`${OTHER.slice(0, 7)}…${OTHER.slice(-4)} was nominated. They haven't accepted yet.`);
        expect(screen.getByTestId("withdraw-submit")).toHaveTextContent("Withdraw nomination");
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
        expect(screen.getByTestId("handover-pill")).toHaveTextContent("Can't be undone");
        expect(screen.getByTestId("handover-text")).toHaveTextContent("You stop being admin at once. From then on only proposals its 2 members vote on can change the DAO. There's no accept step.");
        expect(screen.getByTestId("handover-submit")).toBeDisabled();
        expect(screen.getByTestId("handover-submit")).toHaveTextContent("Hand to its voters");

        expect(screen.getByTestId("handover-voters")).toHaveTextContent("Its voters can vote: 2 members ✓ (the chain refuses a DAO nobody can vote in).");
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
    const TICK = "I understand that becoming the admin of Founders comes with responsibilities. I can act for the DAO and spend its treasury without a vote, so I'll keep this address secure for the DAO's sake: if it's lost or stolen, so is control of the DAO.";
    // Founders is run by the DAO "Parent", which changed its admin after the nomination
    const runByParent = full({admin: "bze1parent", pending_admin: WALLET, pending_admin_seq: "5", admin_seq: "5"});
    const parentChain = (adminSeq: string) => chainOf({
        getController: vi.fn(async () => controller([DAO_ADDRESS, "bze1parent"])),
        getDaoByAddress: vi.fn(async () => full({id: "9", name: "Parent", address: "bze1parent", admin_seq: adminSeq})),
    });

    it("one card: the title, the Nominated pill, the tick, View DAO and the button", async () => {
        renderConsole(nominated);
        const card = await screen.findByTestId("accept-card");
        expect(screen.getByTestId("accept-title")).toHaveTextContent("You're nominated to run Founders");
        expect(screen.getByTestId("nominated-pill")).toHaveTextContent("Nominated");
        expect(screen.getByTestId("accept-understood-text")).toHaveTextContent(TICK);
        expect(screen.getByTestId("accept-view-dao")).toHaveAttribute("href", "/dao/4");
        expect(screen.getByTestId("accept-submit")).toHaveTextContent("Accept and become admin");
        expect(card).not.toHaveTextContent("DAO #");
        expect(screen.queryByTestId("stale-card")).toBeNull();
        expect(screen.queryByTestId("execute-panel")).toBeNull();
    });

    it("has none of the old texts: who nominated, what the nominee takes over, the warning, Not now, the back link", async () => {
        renderConsole(nominated);
        await screen.findByTestId("accept-card");
        // the admin's warning ("Everything you sign is shown before you sign it") is the admin's alone
        expect(screen.queryByTestId("admin-warning")).toBeNull();
        expect(screen.queryByText(/Everything you sign/)).toBeNull();
        expect(screen.queryByTestId("treasury-panel")).toBeNull();
        expect(screen.queryByTestId("rules-panel")).toBeNull();
        expect(screen.queryByText(/nominated your wallet/)).toBeNull();
        expect(screen.queryByText(/Current admin/)).toBeNull();
        expect(screen.queryByText(/can no longer overrule/)).toBeNull();
        expect(screen.queryByText("Not now")).toBeNull();
        expect(screen.queryByText("← Founders")).toBeNull();
        expect(screen.queryByText("What you sign")).toBeNull();
    });

    it("the button stays disabled until the box is ticked, then signs the acceptance as the nominee", async () => {
        landed();
        renderConsole(nominated);
        const submit = await screen.findByTestId("accept-submit");
        expect(submit).toBeDisabled();
        await userEvent.click(submit);
        expect(txMock).not.toHaveBeenCalled();

        const tick = screen.getByTestId("accept-understood");
        expect(tick).toHaveAttribute("role", "checkbox");
        expect(tick).toHaveAttribute("aria-checked", "false");
        await userEvent.click(tick);
        expect(tick).toHaveAttribute("aria-checked", "true");
        expect(submit).toBeEnabled();
        await userEvent.click(screen.getByTestId("accept-understood"));
        expect(submit).toBeDisabled();
        await userEvent.click(screen.getByTestId("accept-understood"));

        await userEvent.click(submit);
        const [msgs] = txMock.mock.calls[0];
        expect(msgs[0].typeUrl).toBe("/bze.dao.MsgAcceptAdminNomination");
        expect(msgs[0].value).toMatchObject({nominee: WALLET, daoId: 4n});
        await waitFor(() => expect(push).toHaveBeenCalledWith("/dao/4"));
    });

    it("stale: the stale card replaces the accept card, naming the DAO that has to nominate again", async () => {
        renderConsole(runByParent, {chain: parentChain("6")});
        expect(await screen.findByTestId("stale-card")).toHaveTextContent("This nomination is out of date");
        expect(screen.getByTestId("stale-pill")).toHaveTextContent("Stale");
        expect(screen.getByTestId("stale-text")).toHaveTextContent("Parent, the DAO that runs Founders, changed its admin after you were nominated, so this nomination can no longer be accepted. Parent has to nominate you again.");
        expect(screen.getByTestId("accept-view-dao")).toHaveAttribute("href", "/dao/4");
        expect(screen.queryByTestId("accept-card")).toBeNull();
        expect(screen.queryByTestId("accept-submit")).toBeNull();
        // no error code and no sequence numbers
        expect(screen.getByTestId("stale-card")).not.toHaveTextContent(/1135|seq/);
    });

    it("stale further up: names the DAO that changed its admin, and the parent as the one to nominate again", async () => {
        const chain = chainOf({
            getController: vi.fn(async () => controller([DAO_ADDRESS, "bze1parent", "bze1guild"])),
            getDaoByAddress: vi.fn(async (address: string) => (address === "bze1parent"
                ? full({id: "9", name: "Parent", address: "bze1parent", admin_seq: "2"})
                : full({id: "12", name: "Guild", address: "bze1guild", admin_seq: "7"}))),
        });
        renderConsole(runByParent, {chain});
        expect(await screen.findByTestId("stale-text")).toHaveTextContent("Guild, which controls Parent, changed its admin after you were nominated, so this nomination can no longer be accepted. Parent has to nominate you again.");
        expect(screen.queryByTestId("accept-card")).toBeNull();
    });

    it("run by a DAO that has not changed its admin: the accept card", async () => {
        renderConsole(runByParent, {chain: parentChain("5")});
        expect(await screen.findByTestId("accept-card")).toBeInTheDocument();
        expect(screen.queryByTestId("stale-card")).toBeNull();
    });

    it("a check the chain could not answer shows the accept card: the chain's own refusal covers it", async () => {
        const getController = vi.fn(async () => { throw new Error("rest"); });
        renderConsole(runByParent, {chain: chainOf({getController})});
        expect(await screen.findByTestId("accept-card")).toBeInTheDocument();
        expect(screen.queryByTestId("stale-card")).toBeNull();
        expect(getController).toHaveBeenCalled();
    });
});
