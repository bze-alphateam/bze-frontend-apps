import {beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, within} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type {Dao, DaoControllerResponse} from "@bze/bze-ui-kit";

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
import type {DaoViewDeps} from "@/lib/dao-view-loader";
import type {RelationDeps} from "@/lib/propose/relations";
import {ProposePage} from "./propose-page";

function deps(dao: Dao): DaoViewDeps {
    return {
        chain: {
            getDao: vi.fn(async (id: string) => (id === dao.id ? dao : null)),
            getParams: vi.fn(async () => PARAMS),
            getController: vi.fn(async () => null),
            getDaoByAddress: vi.fn(async () => null),
            getBalances: vi.fn(async () => [{denom: "ubze", amount: "5000000"}]),
            getOpenProposals: vi.fn(async () => []),
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

const renderPage = (dao: Dao, over: {nominating?: Dao[]; meadowSeq?: string | null} = {}) => render(
    <ChakraProvider value={defaultSystem}>
        <ProposePage id={dao.id} deps={deps(dao)} relationDeps={relationDeps(over.nominating)} nominationChain={nominationChain(over.meadowSeq === undefined ? "0" : over.meadowSeq)} />
    </ChakraProvider>,
);

const openPicker = async () => {
    fireEvent.click(await screen.findByTestId("add-action"));
    return screen.getByTestId("action-picker");
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
        expect(screen.getByTestId("members-remove")).toHaveValue(WALLET);
        expect((screen.getByTestId("proposal-title") as HTMLInputElement).value).toMatch(/^Remove bze1.* as a member$/);
        expect(screen.getByTestId("shortcut-applied")).toHaveTextContent("Leave Founders");
        expect(screen.getByTestId("shortcut-applied")).toHaveTextContent("Prefilled");
        expect(screen.queryByTestId("shortcut-leave")).toBeNull();
    });

    it("a restored draft that already removes the wallet gets no Leave button", async () => {
        window.localStorage.setItem("bze-dao:proposal-draft:4", JSON.stringify({v: 1, title: "Bye", summary: "", expedited: false, actions: [{type: "update-members", fields: {add: "", remove: WALLET}}]}));
        renderPage(pageDao());
        expect(await screen.findByTestId("draft-restored")).toBeTruthy();
        expect(screen.queryByTestId("shortcut-leave")).toBeNull();
    });

    it("Leave is not shown to the last member", async () => {
        renderPage(pageDao({members: [WALLET]}));
        await screen.findByTestId("add-action");
        expect(screen.queryByTestId("shortcut-leave")).toBeNull();
        expect(screen.queryByTestId("shortcuts")).toBeNull();
    });

    it("Request to join: a wallet that is not a member of a DAO anyone can submit to", async () => {
        nav.address = FOURTH;
        renderPage(pageDao({config: {...pageDao().config, open_submission: true}}));
        fireEvent.click(await screen.findByTestId("shortcut-join"));
        expect(screen.getByTestId("members-add")).toHaveValue(FOURTH);
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
        expect(screen.getByTestId("accept-dao")).toHaveValue("9");
    });

    it("stays offered when the stale check cannot be done", async () => {
        renderPage(pageDao(), {nominating: [pollen], meadowSeq: null});
        const picker = await openPicker();
        expect(within(picker).getByTestId("add-accept-nomination-9")).not.toBeDisabled();
    });
});
