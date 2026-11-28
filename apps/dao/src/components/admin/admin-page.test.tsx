import {beforeEach, describe, expect, it, vi} from "vitest";
import {render, screen} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type {Dao} from "@bze/bze-ui-kit";

const nav = vi.hoisted(() => ({push: vi.fn(), replace: vi.fn(), address: undefined as string | undefined}));

vi.mock("next/navigation", () => ({useRouter: () => ({push: nav.push, replace: nav.replace})}));
vi.mock("@interchain-kit/react", () => ({useChain: () => ({address: nav.address})}));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    getChainName: () => "beezee",
    getTxLanding: vi.fn(async () => "notfound"),
    useSDKTx: () => ({tx: vi.fn(), progressTrack: ""}),
    useToast: () => ({toast: {error: vi.fn()}}),
    useAssets: () => ({
        getAsset: (denom: string) => (denom === "ubze" ? {denom, decimals: 6} : undefined),
        denomTicker: (denom: string) => (denom === "ubze" ? "BZE" : denom),
    }),
    useAssetsValue: () => ({denomUsdValue: () => new BigNumber(0)}),
}));
vi.mock("@/lib/dao-chain", () => ({liveDaoViewDeps: {}, liveRelationDeps: {}, liveNominationChain: {}, liveProposalDeps: {}, liveSubDaoDeps: {}}));

import {PARAMS, THIRD, WALLET} from "@/test/composer-fixtures";
import {pageDao} from "@/test/dao-page-fixtures";
import type {NominationChain} from "@/lib/admin/nomination";
import type {DaoViewDeps} from "@/lib/dao-view-loader";
import type {RelationDeps} from "@/lib/propose/relations";
import {AdminPage} from "./admin-page";

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

const relationDeps = {
    chain: {
        getDao: vi.fn(async () => null),
        getDaosByAdmin: vi.fn(async () => ({items: [], nextKey: null})),
        getBalances: vi.fn(async () => []),
        getStakeOptions: vi.fn(async () => []),
    },
    scan: {daosNominating: vi.fn(async () => [])},
} as unknown as RelationDeps;

const nominationChain: NominationChain = {getController: async () => null, getDaoByAddress: async () => null};

const page = (dao: Dao) => (
    <ChakraProvider value={defaultSystem}>
        <AdminPage id={dao.id} deps={deps(dao)} relationDeps={relationDeps} nominationChain={nominationChain} />
    </ChakraProvider>
);

beforeEach(() => {
    nav.push.mockReset();
    window.localStorage.clear();
});

describe("the admin console page", () => {
    const administered = pageDao({admin: WALLET});

    it("shows the console under the shell, with the Admin console tab active", async () => {
        nav.address = WALLET;
        render(page(administered));
        expect(await screen.findByTestId("admin-console")).toHaveAttribute("data-role", "admin");
        expect(screen.getByTestId("admin-console-link")).toHaveAttribute("aria-current", "page");
    });

    it("a disconnect keeps the tab and the console together: both follow the wallet the console belongs to", async () => {
        nav.address = WALLET;
        const {rerender} = render(page(administered));
        await screen.findByTestId("admin-console");
        expect(screen.getByTestId("admin-console-link")).toBeInTheDocument();

        nav.address = undefined;
        rerender(page(administered));
        expect(screen.getByTestId("admin-console")).toBeInTheDocument();
        expect(screen.getByTestId("admin-console-link")).toBeInTheDocument();
    });

    it("without any wallet, neither the tab nor the console shows", async () => {
        nav.address = undefined;
        render(page(administered));
        expect(await screen.findByTestId("admin-needs-wallet")).toBeInTheDocument();
        expect(screen.queryByTestId("admin-console")).toBeNull();
        expect(screen.queryByTestId("admin-console-link")).toBeNull();
    });

    it("a stranger's wallet gets no tab and no console", async () => {
        nav.address = THIRD;
        render(page(administered));
        expect(await screen.findByTestId("no-console")).toBeInTheDocument();
        expect(screen.queryByTestId("admin-console-link")).toBeNull();
    });
});
