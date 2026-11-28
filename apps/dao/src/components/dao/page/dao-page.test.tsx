import {beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type {Dao} from "@bze/bze-ui-kit";

const nav = vi.hoisted(() => ({search: "", push: vi.fn(), replace: vi.fn(), address: undefined as string | undefined}));

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(nav.search),
    useRouter: () => ({push: nav.push, replace: nav.replace}),
}));
vi.mock("@interchain-kit/react", () => ({useChain: () => ({address: nav.address})}));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    getChainName: () => "beezee",
    useToast: () => ({toast: {error: vi.fn()}}),
    useAssets: () => ({
        getAsset: (denom: string) => (denom === "ubze" ? {denom, decimals: 6} : undefined),
        denomTicker: (denom: string) => (denom === "ubze" ? "BZE" : denom),
    }),
    useAssetsValue: () => ({denomUsdValue: () => new BigNumber(0)}),
}));
vi.mock("@/lib/dao-chain", () => ({liveDaoViewDeps: {}, liveProposalDeps: {}, liveSubDaoDeps: {}}));

import {FOURTH, PARAMS, THIRD, WALLET} from "@/test/composer-fixtures";
import {pageDao} from "@/test/dao-page-fixtures";
import type {SubDaoDeps} from "@/lib/dao-subdaos";
import type {ScanDaoDetail} from "@/lib/dao-types";
import type {DaoViewDeps} from "@/lib/dao-view-loader";
import type {ProposalDeps} from "@/lib/proposal-loader";
import {DaoPage} from "./dao-page";

function deps(dao: Dao, detail: Partial<ScanDaoDetail> | null = {proposals_open: 1, proposals_total: 3}): DaoViewDeps {
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
            daoDetail: vi.fn(async () => detail as ScanDaoDetail | null),
            history: vi.fn(async () => ({items: [], next_cursor: null})),
            votesByVoter: vi.fn(async () => ({items: [], next_cursor: null, supported: true})),
        },
    } as unknown as DaoViewDeps;
}

const proposalDeps = {
    chain: {getDaoProposals: vi.fn(async () => ({items: [], nextKey: null}))},
    scan: {listForDao: vi.fn(async () => ({items: [], next_cursor: null}))},
} as unknown as ProposalDeps;

const subDaoDeps: SubDaoDeps = {chain: {getDaosByAdmin: async () => ({items: [], nextKey: null})}, scan: {listDaos: async () => ({items: [], next_cursor: null, supported: true, total: null})}};

function renderPage(dao: Dao, {search = "", address}: {search?: string; address?: string} = {}) {
    nav.search = search;
    nav.address = address;
    return render(
        <ChakraProvider value={defaultSystem}>
            <DaoPage id={dao.id} deps={deps(dao)} proposalDeps={proposalDeps} subDaoDeps={subDaoDeps} />
        </ChakraProvider>,
    );
}

beforeEach(() => {
    nav.push.mockReset();
    nav.replace.mockReset();
});

describe("the DAO page", () => {
    describe("Request to join, in Who votes", () => {
        const open = (over: Partial<Dao> = {}) => pageDao({config: {...pageDao().config, open_submission: true}, ...over});

        it("is offered to a wallet that is not a member of a DAO open to anyone, and opens the composer with the join shortcut", async () => {
            renderPage(open(), {address: FOURTH});
            const link = await screen.findByTestId("request-to-join");
            expect(link).toHaveAttribute("href", "/dao/4/propose?shortcut=join");
            expect(link).toHaveTextContent("Request to join");
            expect(screen.getByTestId("join-note")).toHaveTextContent("You're not a member. Proposals here are open to anyone: ask to join with a proposal that adds you.");
        });

        it("is not offered to a member, to a DAO only its members can submit to, nor without a wallet", async () => {
            const member = renderPage(open(), {address: WALLET});
            await screen.findByTestId("voters-panel");
            expect(screen.queryByTestId("request-to-join")).toBeNull();
            member.unmount();

            const closed = renderPage(pageDao(), {address: FOURTH});
            await screen.findByTestId("voters-panel");
            expect(screen.queryByTestId("request-to-join")).toBeNull();
            closed.unmount();

            renderPage(open());
            await screen.findByTestId("voters-panel");
            expect(screen.queryByTestId("request-to-join")).toBeNull();
        });

        it("is not offered when the DAO cannot take a proposal now (no voters)", async () => {
            renderPage(open({members: []}), {address: FOURTH});
            await screen.findByTestId("no-voters");
            expect(screen.queryByTestId("request-to-join")).toBeNull();
        });
    });

    it("opens on the Overview: Who controls it, Who votes, Treasury and the wallet's power", async () => {
        renderPage(pageDao(), {address: WALLET});
        expect(await screen.findByTestId("overview-tab")).toBeInTheDocument();
        expect(screen.getByTestId("dao-tab-overview")).toHaveAttribute("aria-current", "page");
        expect(screen.getByTestId("control-panel")).toBeInTheDocument();
        expect(screen.getByTestId("voters-panel")).toBeInTheDocument();
        expect(screen.getByTestId("treasury-panel")).toBeInTheDocument();
        expect(await screen.findByTestId("power-panel")).toBeInTheDocument();
        expect(await screen.findByTestId("proposals-counter")).toHaveTextContent("1/3");
    });

    it("has no How to join, no Leave, no Rules card, no treasury footnote, no Free-proposals warning and no DAO number", async () => {
        renderPage(pageDao(), {address: WALLET});
        await screen.findByTestId("overview-tab");
        expect(screen.queryByTestId("join-panel")).toBeNull();
        expect(screen.queryByText("How to join")).toBeNull();
        expect(screen.queryByTestId("leave-dao")).toBeNull();
        expect(screen.queryByTestId("request-to-join")).toBeNull();
        expect(screen.queryByText(/Leave/)).toBeNull();
        expect(screen.queryByTestId("rules-panel")).toBeNull();
        expect(screen.queryByText(/held by the DAO module/)).toBeNull();
        expect(screen.queryByText(/Proposals are free here/)).toBeNull();
        expect(screen.queryByText(/Member since/)).toBeNull();
        expect(document.body.textContent).not.toMatch(/DAO #/);
        expect(screen.queryByRole("link", {name: "New proposal"})).toBeNull();
    });

    it("?tab=proposals opens the Proposals tab, with New proposal for a connected wallet", async () => {
        renderPage(pageDao(), {search: "tab=proposals", address: WALLET});
        expect(await screen.findByTestId("proposals-tab")).toBeInTheDocument();
        expect(screen.getByTestId("dao-tab-proposals")).toHaveAttribute("aria-current", "page");
        expect(screen.getByTestId("new-proposal")).toHaveAttribute("href", "/dao/4/propose");
        expect(screen.queryByTestId("overview-tab")).toBeNull();
    });

    it("no New proposal without a wallet", async () => {
        renderPage(pageDao(), {search: "tab=proposals"});
        expect(await screen.findByTestId("proposals-tab")).toBeInTheDocument();
        expect(screen.queryByTestId("new-proposal")).toBeNull();
    });

    it("?tab=history opens the History tab; an unknown tab is the Overview", async () => {
        const {unmount} = renderPage(pageDao(), {search: "tab=history"});
        expect(await screen.findByTestId("history-tab")).toBeInTheDocument();
        unmount();
        renderPage(pageDao(), {search: "tab=nope"});
        expect(await screen.findByTestId("overview-tab")).toBeInTheDocument();
    });

    it("the Admin console tab is there for the admin", async () => {
        renderPage(pageDao({admin: THIRD}), {address: THIRD});
        expect(await screen.findByTestId("admin-console-link")).toHaveAttribute("href", "/dao/4/admin");
    });
});

describe("an unknown DAO", () => {
    it("says not found and links back to the DAOs", async () => {
        nav.search = "";
        render(
            <ChakraProvider value={defaultSystem}>
                <DaoPage id="9" deps={deps(pageDao())} proposalDeps={proposalDeps} subDaoDeps={subDaoDeps} />
            </ChakraProvider>,
        );
        expect(await screen.findByText("DAO not found")).toBeInTheDocument();
        expect(screen.getByRole("link", {name: "All DAOs"})).toHaveAttribute("href", "/");
        expect(screen.queryByTestId("dao-shell")).toBeNull();
    });
});
