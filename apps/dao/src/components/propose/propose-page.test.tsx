import {beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, within} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type {Dao, DaoControllerResponse, DaoParams} from "@bze/bze-ui-kit";

const nav = vi.hoisted(() => ({push: vi.fn(), replace: vi.fn(), address: undefined as string | undefined}));

vi.mock("next/navigation", () => ({useRouter: () => ({push: nav.push, replace: nav.replace}), usePathname: () => "/dao/4/propose"}));
vi.mock("@interchain-kit/react", () => ({useChain: () => ({address: nav.address})}));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    getChainName: () => "beezee",
    getTxLanding: vi.fn(async () => "notfound"),
    getTxEvents: vi.fn(async () => null),
    useBZETx: () => ({tx: vi.fn()}),
    useBalances: () => ({getBalanceByDenom: (denom: string) => ({denom, amount: "0"}), isLoading: false}),
    useToast: () => ({toast: {error: vi.fn()}}),
    useAssets: () => ({
        getAsset: (denom: string) => (denom === "ubze" ? {denom, decimals: 6} : undefined),
        denomTicker: (denom: string) => (denom === "ubze" ? "BZE" : denom),
    }),
    useAssetsValue: () => ({denomUsdValue: () => new BigNumber(0)}),
}));
vi.mock("@/lib/dao-chain", () => ({liveDaoViewDeps: {}, liveRelationDeps: {}, liveNominationChain: {}, liveProposalDeps: {}, liveSubDaoDeps: {}}));

import {DAO_ADDRESS, FOURTH, OTHER, PARAMS, SUB_ADDRESS, WALLET} from "@/test/composer-fixtures";
import {pageDao} from "@/test/dao-page-fixtures";
import type {NominationChain} from "@/lib/admin/nomination";
import {shortAddress} from "@/lib/format";
import type {DaoViewDeps} from "@/lib/dao-view-loader";
import type {RelationDeps} from "@/lib/propose/relations";
import {ProposePage} from "./propose-page";

function deps(dao: Dao, params: DaoParams = PARAMS, open: unknown[] = []): DaoViewDeps {
    return {
        chain: {
            getDao: vi.fn(async (id: string) => (id === dao.id ? dao : null)),
            getParams: vi.fn(async () => params),
            getController: vi.fn(async () => null),
            getDaoByAddress: vi.fn(async () => null),
            getBalances: vi.fn(async () => [{denom: "ubze", amount: "5000000"}]),
            getOpenProposals: vi.fn(async () => open),
            getStakeSources: vi.fn(async () => []),
            getVotingPower: vi.fn(async () => ({current: "1", proposals: []})),
        },
        scan: {
            daoDetail: vi.fn(async () => null),
            history: vi.fn(async () => ({items: [], next_cursor: null})),
            votesByVoter: vi.fn(async () => ({items: [], next_cursor: null, supported: true})),
        },
    } as unknown as DaoViewDeps;
}

// DAO 9 "Pollen Fund" nominated Founders; it is run by DAO 12 "Meadow DAO", and the nomination was made at sequence 5
const MEADOW = SUB_ADDRESS;
const pollen = pageDao({id: "9", address: OTHER, admin: MEADOW, name: "Pollen Fund", pending_admin: DAO_ADDRESS, pending_admin_seq: "5"});

const relationDeps = (nominating: Dao[] = []) => ({
    chain: {
        getDao: vi.fn(async (id: string) => nominating.find((d) => d.id === id) ?? null),
        getDaosByAdmin: vi.fn(async () => ({items: [], nextKey: null})),
        getBalances: vi.fn(async () => []),
        getStakeOptions: vi.fn(async () => []),
    },
    scan: {daosNominating: vi.fn(async () => nominating.map((d) => ({id: d.id})))},
}) as unknown as RelationDeps;

/** The chain of the stale check: Meadow DAO changed its admin at `meadowSeq`; null = the controller cannot be read. */
const nominationChain = (meadowSeq: string | null): NominationChain => ({
    getController: async (): Promise<DaoControllerResponse | null> => {
        if (meadowSeq === null) throw new Error("HTTP 500");
        return {controller: "bze1person", end_reason: "ACCOUNT", path: [OTHER, MEADOW]};
    },
    getDaoByAddress: async (address: string) => (address === MEADOW ? pageDao({id: "12", address: MEADOW, name: "Meadow DAO", admin_seq: meadowSeq ?? "0"}) : null),
});

const renderPage = (dao: Dao, over: {nominating?: Dao[]; meadowSeq?: string | null; params?: DaoParams; open?: unknown[]} = {}) => render(
    <ChakraProvider value={defaultSystem}>
        <ProposePage id={dao.id} deps={deps(dao, over.params, over.open)} relationDeps={relationDeps(over.nominating)} nominationChain={nominationChain(over.meadowSeq === undefined ? "0" : over.meadowSeq)} />
    </ChakraProvider>,
);

const openPicker = async () => {
    fireEvent.click(await screen.findByTestId("add-action"));
    return screen.findByTestId("action-picker");
};

beforeEach(() => {
    nav.push.mockReset();
    nav.replace.mockReset();
    nav.address = WALLET;
    window.localStorage.clear();
});

describe("the composer's top", () => {
    it("is the proposal page's: a back link to the DAO's Proposals tab, then the title", async () => {
        renderPage(pageDao());
        const back = await screen.findByTestId("propose-back");
        expect(back).toHaveAttribute("href", "/dao/4?tab=proposals");
        expect(back).toHaveTextContent("Founders · proposals");
        expect(screen.getByTestId("propose-title")).toHaveTextContent(/^New proposal$/);
    });

    it("has no breadcrumb and no link to the Overview", async () => {
        renderPage(pageDao());
        await screen.findByTestId("add-action");
        expect(screen.queryByText("← Founders")).toBeNull();
        expect(screen.queryByText(/New proposal for/)).toBeNull();
        expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).not.toContain("/dao/4");
    });
});

describe("the join / leave shortcuts", () => {
    it("Leave: offered to a member who is not the last one, and fills in the wallet's removal", async () => {
        renderPage(pageDao());
        fireEvent.click(await screen.findByTestId("shortcut-leave"));
        expect(screen.getByTestId("action-preview")).toHaveTextContent(`Remove ${shortAddress(WALLET)} (you)`);
        expect((screen.getByTestId("proposal-title") as HTMLInputElement).value).toMatch(/^Remove bze1.* as a member$/);
        expect(screen.getByTestId("shortcut-applied")).toHaveTextContent("Leave Founders");
        expect(screen.getByTestId("shortcut-applied")).toHaveTextContent("Prefilled");
        expect(screen.queryByTestId("shortcut-leave")).toBeNull();
        expect(screen.getByTestId("shortcut-note")).toHaveTextContent("you're not the last member");
    });

    it("a restored draft that already removes the wallet gets no Leave button", async () => {
        window.localStorage.setItem("bze-dao:proposal-draft:4", JSON.stringify({v: 1, title: "Bye", summary: "", expedited: false, actions: [{type: "update-members", fields: {add: "", remove: WALLET}}]}));
        renderPage(pageDao());
        expect(await screen.findByTestId("draft-restored")).toBeTruthy();
        expect(screen.queryByTestId("shortcut-leave")).toBeNull();
    });

    it("Prefilled lasts only while the wallet's change is in the list: removing it offers Leave again", async () => {
        renderPage(pageDao());
        fireEvent.click(await screen.findByTestId("shortcut-leave"));
        expect(screen.getByTestId("shortcut-applied")).toHaveTextContent("Prefilled");
        fireEvent.click(screen.getByTestId("action-remove"));
        expect(screen.queryByTestId("shortcut-applied")).toBeNull();
        expect(screen.getByTestId("shortcut-leave")).toBeTruthy();
    });

    it("never adds an action past the limit: with the list full there is no shortcut button", async () => {
        window.localStorage.setItem("bze-dao:proposal-draft:4", JSON.stringify({v: 1, title: "Pay", summary: "", expedited: false, actions: [{type: "pay", fields: {denom: "ubze", amount: "1", to: OTHER}}]}));
        renderPage(pageDao(), {params: {...PARAMS, max_msgs_per_proposal: "1"}});
        expect(await screen.findByTestId("draft-restored")).toBeTruthy();
        expect(screen.getAllByTestId("action-row")).toHaveLength(1);
        expect(screen.queryByTestId("shortcut-leave")).toBeNull();
    });

    it("a DAO at its open-proposal limit offers neither shortcut, and the leave link fills nothing in", async () => {
        const full = Array.from({length: Number(PARAMS.max_open_proposals)}, (_, i) => ({id: String(i + 1)}));
        window.history.replaceState(null, "", "/dao/4/propose?shortcut=leave");
        try {
            renderPage(pageDao(), {open: full});
            expect(await screen.findByTestId("gate-blocked")).toBeTruthy();
            expect(screen.queryByTestId("shortcuts")).toBeNull();
            expect(screen.queryAllByTestId("action-row")).toHaveLength(0);
        } finally {
            window.history.replaceState(null, "", "/");
        }
    });

    it("Leave is not shown to the last member, who is told why", async () => {
        renderPage(pageDao({members: [WALLET]}));
        await screen.findByTestId("add-action");
        expect(screen.queryByTestId("shortcut-leave")).toBeNull();
        expect(screen.queryByTestId("shortcuts")).toBeNull();
        expect(screen.getByTestId("shortcut-last-member")).toHaveTextContent("You're the last member. A DAO needs at least one, so Leave is offered again once someone else is added.");
    });

    it("a member who is not the last one gets no last-member note", async () => {
        renderPage(pageDao());
        await screen.findByTestId("shortcut-leave");
        expect(screen.queryByTestId("shortcut-last-member")).toBeNull();
    });

    it("Request to join: a wallet that is not a member of a DAO anyone can submit to", async () => {
        nav.address = FOURTH;
        renderPage(pageDao({config: {...pageDao().config, open_submission: true}}));
        fireEvent.click(await screen.findByTestId("shortcut-join"));
        expect(screen.getByTestId("action-preview")).toHaveTextContent(`Add ${shortAddress(FOURTH)} (you)`);
        expect(screen.getByTestId("shortcut-applied")).toHaveTextContent("Request to join Founders");
        expect(screen.queryByTestId("shortcut-leave")).toBeNull();
    });

    it("Request to join is not shown when only members can submit, nor to a member, nor on a stake DAO", async () => {
        nav.address = FOURTH;
        const closed = renderPage(pageDao());
        await screen.findByTestId("add-action");
        expect(screen.queryByTestId("shortcut-join")).toBeNull();
        closed.unmount();

        nav.address = WALLET;
        const member = renderPage(pageDao({config: {...pageDao().config, open_submission: true}}));
        await screen.findByTestId("add-action");
        expect(screen.queryByTestId("shortcut-join")).toBeNull();
        member.unmount();

        nav.address = FOURTH;
        renderPage(pageDao({type: "DAO_TYPE_STAKE", members: [], electorate: {sr_ids: ["000000000017"], dr_denom: ""}, config: {...pageDao().config, open_submission: true}}));
        await screen.findByTestId("add-action");
        expect(screen.queryByTestId("shortcuts")).toBeNull();
    });

    it("the not-a-member note does not point to how to join", async () => {
        nav.address = FOURTH;
        renderPage(pageDao());
        const gate = await screen.findByTestId("gate-not-a-voter");
        expect(gate).toHaveTextContent("Ask a member to propose adding you.");
        expect(within(gate).queryAllByRole("link")).toHaveLength(0);
        expect(gate).not.toHaveTextContent(/how to join/i);
    });
});

describe("accepting a nomination", () => {
    it("a stale nomination is greyed out and disabled, and cannot be added", async () => {
        renderPage(pageDao(), {nominating: [pollen], meadowSeq: "6"});
        const picker = await openPicker();
        const stale = within(picker).getByTestId("stale-nomination-9");
        expect(stale).toBeDisabled();
        expect(stale).toHaveTextContent("Stale");
        expect(stale).toHaveTextContent("Out of date: Meadow DAO, the DAO that runs Pollen Fund, changed its admin after Founders was nominated. Meadow DAO has to nominate it again.");
        expect(within(picker).queryByTestId("add-accept-nomination-9")).toBeNull();
    });

    it("a nomination that is still valid is offered", async () => {
        renderPage(pageDao(), {nominating: [pollen], meadowSeq: "5"});
        const picker = await openPicker();
        const accept = within(picker).getByTestId("add-accept-nomination-9");
        expect(accept).not.toBeDisabled();
        expect(within(picker).queryByTestId("stale-nomination-9")).toBeNull();
        fireEvent.click(accept);
        // the row chose the DAO: the form card names it instead of asking again
        expect(screen.queryByTestId("accept-dao")).toBeNull();
        expect(screen.getByTestId("accept-text")).toHaveTextContent("Pollen Fund nominated Founders as its admin. If this passes, Founders runs Pollen Fund through its own proposals.");
    });

    it("a restored draft whose accept went stale loses that action, and the DAO cannot be picked", async () => {
        window.localStorage.setItem("bze-dao:proposal-draft:4", JSON.stringify({v: 1, title: "Take Pollen Fund", summary: "", expedited: false, actions: [{type: "accept-nomination", fields: {daoId: "9"}}]}));
        renderPage(pageDao(), {nominating: [pollen], meadowSeq: "6"});
        expect(await screen.findByTestId("draft-restored")).toBeTruthy();
        expect(screen.getByTestId("proposal-title")).toHaveValue("Take Pollen Fund");
        expect(screen.queryAllByTestId("action-row")).toHaveLength(0);
        expect(screen.queryByTestId("accept-dao")).toBeNull();
    });

    it("stays offered when the stale check cannot be done", async () => {
        renderPage(pageDao(), {nominating: [pollen], meadowSeq: null});
        const picker = await openPicker();
        expect(within(picker).getByTestId("add-accept-nomination-9")).not.toBeDisabled();
    });
});

describe("the composer's layout (board F1)", () => {
    it("is a main card (basics, actions, size bar) next to the Before you submit aside and the draft card", async () => {
        renderPage(pageDao());
        const card = await screen.findByTestId("proposal-card");
        expect(within(card).getByTestId("proposal-title")).toBeTruthy();
        expect(within(card).getByTestId("actions-editor")).toHaveTextContent("What it does if it passes");
        expect(within(card).getByTestId("size-text")).toHaveTextContent("of 20,000 bytes · 0 of 16 actions");
        const aside = screen.getByTestId("composer-aside");
        expect(within(aside).getByTestId("submit-panel")).toHaveTextContent("Before you submit");
        expect(within(aside).getByTestId("draft-note")).toHaveTextContent("Draft saved on this device. It's cleared once the proposal is submitted.");
    });

    it("an action whose form card is still open is never left out silently: Submit waits for it", async () => {
        renderPage(pageDao());
        fireEvent.change(await screen.findByTestId("proposal-title"), {target: {value: "Pay someone"}});
        expect(screen.getByTestId("submit-proposal")).not.toBeDisabled();
        const picker = await openPicker();
        fireEvent.click(within(picker).getByTestId("add-pay"));
        expect(screen.getByTestId("submit-proposal")).toBeDisabled();
        expect(screen.getByTestId("submit-problem")).toHaveTextContent("An action is still open: add it to the proposal or cancel it.");
        fireEvent.click(screen.getByTestId("action-cancel"));
        expect(screen.getByTestId("submit-proposal")).not.toBeDisabled();
    });

    it("counts the proposal slots in use from the open proposals", async () => {
        renderPage(pageDao(), {open: [{id: "1"}, {id: "2"}]});
        expect(await screen.findByTestId("proposal-slots")).toHaveTextContent("2 of 10 proposal slots are in use.");
    });

    it("a restored draft says so in the draft card, with Discard", async () => {
        window.localStorage.setItem("bze-dao:proposal-draft:4", JSON.stringify({v: 1, title: "Hello", summary: "", expedited: false, actions: []}));
        renderPage(pageDao());
        const restored = await screen.findByTestId("draft-restored");
        expect(within(screen.getByTestId("draft-card")).getByTestId("draft-restored")).toBe(restored);
        fireEvent.click(screen.getByTestId("draft-discard"));
        expect(screen.getByTestId("proposal-title")).toHaveValue("");
        expect(screen.getByTestId("draft-note")).toBeTruthy();
    });
});
