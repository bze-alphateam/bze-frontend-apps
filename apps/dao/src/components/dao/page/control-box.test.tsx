import {describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, within} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type {Dao, DaoControllerResponse} from "@bze/bze-ui-kit";

vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    useToast: () => ({toast: {error: vi.fn()}}),
    useAssets: () => ({
        getAsset: (denom: string) => (denom === "ubze" ? {denom, decimals: 6} : undefined),
        denomTicker: (denom: string) => (denom === "ubze" ? "BZE" : denom),
    }),
    useAssetsValue: () => ({denomUsdValue: () => new BigNumber(0)}),
}));

import {DAO_ADDRESS, OTHER, OTHER_DAO_ADDRESS, THIRD, WALLET} from "@/test/composer-fixtures";
import {pageDao, pageView} from "@/test/dao-page-fixtures";
import type {SubDaoDeps} from "@/lib/dao-subdaos";
import type {ScanDaoDetail} from "@/lib/dao-types";
import type {DaoView} from "@/lib/dao-view-loader";
import {ControlBox} from "./control-box";

const subDao = (id: number, over: Partial<Dao> = {}): Dao => pageDao({id: String(id), address: `bze1sub${id}`, admin: DAO_ADDRESS, name: `Sub ${id}`, ...over});

function subDeps(subs: Dao[], open: (id: string) => number | undefined = (id) => Number(id) % 3): SubDaoDeps {
    return {
        chain: {getDaosByAdmin: vi.fn(async () => ({items: subs, nextKey: null}))},
        scan: {daoDetail: vi.fn(async (id: string) => ({proposals_open: open(id)}) as ScanDaoDetail)},
    };
}

const walk = (controller: string, end_reason: DaoControllerResponse["end_reason"], path: string[]): DaoView["controller"] => ({ok: true, value: {controller, end_reason, path}});

function renderBox({view = pageView(), wallet = null as string | null, detail = null as Partial<ScanDaoDetail> | null, subs = [] as Dao[], deps}: {view?: DaoView; wallet?: string | null; detail?: Partial<ScanDaoDetail> | null; subs?: Dao[]; deps?: SubDaoDeps} = {}) {
    return render(
        <ChakraProvider value={defaultSystem}>
            <ControlBox view={view} wallet={wallet} detail={detail as ScanDaoDetail | null} nameOf={() => undefined} subDaoDeps={deps ?? subDeps(subs)} />
        </ChakraProvider>,
    );
}

const admin = () => screen.getByTestId("control-admin");

describe("the Admin cell", () => {
    it("no admin: the DAO owns itself, every change needs a passed proposal", () => {
        renderBox();
        expect(admin()).toHaveAttribute("data-kind", "none");
        expect(admin()).toHaveTextContent("No admin");
        expect(admin()).toHaveTextContent("needs a passed proposal");
    });

    it("an account: amber, it can act without a vote", () => {
        const dao = pageDao({admin: THIRD});
        renderBox({view: pageView(dao, {controller: walk(THIRD, "ACCOUNT", [DAO_ADDRESS])}), wallet: OTHER});
        expect(admin()).toHaveAttribute("data-kind", "account");
        expect(admin()).toHaveTextContent("One account. It can run any action as the DAO and change its rules without a vote.");
        expect(within(admin()).getByTestId("control-headline")).toHaveTextContent(THIRD.slice(0, 8));
    });

    it("the connected wallet is the admin: 'You', and the Admin console tab is named", () => {
        const dao = pageDao({admin: THIRD});
        renderBox({view: pageView(dao, {controller: walk(THIRD, "ACCOUNT", [DAO_ADDRESS])}), wallet: THIRD});
        expect(admin()).toHaveAttribute("data-kind", "you");
        expect(admin()).toHaveTextContent("You");
        expect(admin()).toHaveTextContent("from the Admin console tab");
    });

    it("another DAO: its name links to it, as the parent DAO whose proposals act here without a vote, and no DAO number", () => {
        const dao = pageDao({admin: OTHER_DAO_ADDRESS});
        const knownDaos = new Map([[DAO_ADDRESS, {id: "4", name: "Founders"}], [OTHER_DAO_ADDRESS, {id: "9", name: "Hive Council"}]]);
        renderBox({view: pageView(dao, {knownDaos, controller: walk(OTHER_DAO_ADDRESS, "SELF_OWNED", [DAO_ADDRESS, OTHER_DAO_ADDRESS])})});
        expect(admin()).toHaveAttribute("data-kind", "dao");
        expect(within(admin()).getByTestId("control-headline")).toHaveAttribute("href", "/dao/9");
        expect(within(admin()).getByTestId("control-headline")).toHaveTextContent("Hive Council");
        expect(admin()).toHaveTextContent("Its parent DAO. Its proposals can act for this DAO and change its rules without a vote here.");
        expect(admin()).not.toHaveTextContent(/#9|DAO #/);
        expect(screen.queryByTestId("control-chain")).toBeNull();
    });

    it("a parent DAO run by an account: the whole chain is shown, ending at that account, with the warning", () => {
        const dao = pageDao({admin: OTHER_DAO_ADDRESS});
        const knownDaos = new Map([[DAO_ADDRESS, {id: "4", name: "Founders"}], [OTHER_DAO_ADDRESS, {id: "9", name: "Hive Council"}]]);
        renderBox({view: pageView(dao, {knownDaos, controller: walk(THIRD, "ACCOUNT", [DAO_ADDRESS, OTHER_DAO_ADDRESS])})});
        const chain = screen.getByTestId("control-chain");
        expect(chain).toHaveTextContent("Founders");
        expect(chain).toHaveTextContent("Hive Council");
        expect(chain).toHaveTextContent(THIRD.slice(0, 10));
        expect(admin()).toHaveTextContent("external admin");
    });

    it("the chain cannot tell what the admin is, but Scan's label says it is a DAO: shown by Scan's name", () => {
        const dao = pageDao({admin: OTHER_DAO_ADDRESS});
        renderBox({
            view: pageView(dao, {controller: {ok: false}, unresolved: new Set([OTHER_DAO_ADDRESS])}),
            detail: {admin_label: {name: "Hive Council", kind: "dao"}},
        });
        expect(admin()).toHaveAttribute("data-kind", "dao");
        expect(admin()).toHaveTextContent("Hive Council");
    });

    it("unknown, and Scan does not say either: neither called an account nor a DAO", () => {
        const dao = pageDao({admin: OTHER_DAO_ADDRESS});
        renderBox({view: pageView(dao, {controller: {ok: false}, unresolved: new Set([OTHER_DAO_ADDRESS])})});
        expect(admin()).toHaveAttribute("data-kind", "unknown");
        expect(admin()).toHaveTextContent("could not be checked right now");
    });

    it("a pending nomination is said in the cell", () => {
        const dao = pageDao({admin: THIRD, pending_admin: OTHER});
        renderBox({view: pageView(dao, {controller: walk(THIRD, "ACCOUNT", [DAO_ADDRESS])})});
        expect(screen.getByTestId("control-pending")).toHaveTextContent("is nominated as the new admin");
    });
});

describe("the Voters cell", () => {
    it("a member list: the member count and one line", () => {
        renderBox();
        expect(screen.getByTestId("control-voters")).toHaveTextContent("2 members");
        expect(screen.getByTestId("control-voters")).toHaveTextContent("A member list, one vote each.");
    });

    it("stakers: the staked token", () => {
        const dao = pageDao({type: "DAO_TYPE_STAKE", members: [], electorate: {sr_ids: ["000000000017"], dr_denom: ""}});
        const sources = {ok: true as const, value: [{kind: "sr" as const, id: "000000000017", stakingDenom: "ubze", lockDays: 7, staked: "1", own: "0"}]};
        renderBox({view: pageView(dao, {sources})});
        expect(screen.getByTestId("control-voters")).toHaveTextContent("BZE stakers");
        expect(screen.getByTestId("control-voters")).toHaveTextContent("voting power = stake");
    });
});

describe("the SubDAOs", () => {
    it("none: no SubDAOs section", async () => {
        const deps = subDeps([pageDao()]);
        renderBox({deps});
        await vi.waitFor(() => expect(deps.chain.getDaosByAdmin).toHaveBeenCalledWith(DAO_ADDRESS, null));
        expect(screen.queryByTestId("subdaos")).toBeNull();
    });

    it("three: each with its name as a link, who governs it and its open count", async () => {
        renderBox({subs: [subDao(1, {type: "DAO_TYPE_STAKE"}), subDao(3), subDao(5)]});
        const section = await screen.findByTestId("subdaos");
        expect(section).toHaveTextContent("SubDAOs · 3");
        const rows = within(section).getAllByTestId("subdao-row");
        expect(rows).toHaveLength(3);
        expect(rows[0]).toHaveAttribute("href", "/dao/1");
        expect(rows[0]).toHaveTextContent("Sub 1");
        expect(rows[0]).toHaveTextContent("Governed by stakers");
        expect(rows[0]).toHaveTextContent("1 voting");
        expect(rows[1]).toHaveTextContent("Governed by a member list");
        expect(rows[1]).toHaveTextContent("Nothing to vote on");
        expect(screen.queryByTestId("subdaos-all")).toBeNull();
    });

    it("eight: five rows, then 'Show all 8' expands the list", async () => {
        renderBox({subs: Array.from({length: 8}, (_, i) => subDao(i + 1))});
        const section = await screen.findByTestId("subdaos");
        expect(within(section).getAllByTestId("subdao-row")).toHaveLength(5);
        fireEvent.click(screen.getByTestId("subdaos-all"));
        expect(within(section).getAllByTestId("subdao-row")).toHaveLength(8);
        expect(screen.queryByTestId("subdaos-all")).toBeNull();
    });

    it("Scan without counts: the rows stay, the counts are left out", async () => {
        renderBox({deps: subDeps([subDao(1), subDao(2)], () => undefined)});
        const section = await screen.findByTestId("subdaos");
        expect(within(section).getAllByTestId("subdao-row")).toHaveLength(2);
        expect(within(section).queryByTestId("subdao-open")).toBeNull();
    });
});

describe("the governance rules", () => {
    it("are hidden until 'See governance rules' expands them inside the box", () => {
        renderBox();
        const toggle = screen.getByTestId("rules-toggle");
        expect(toggle).toHaveTextContent("See governance rules");
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByTestId("rules-list")).toBeNull();

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute("aria-expanded", "true");
        expect(toggle).toHaveTextContent("Hide governance rules");
        const rules = screen.getByTestId("rules-list");
        expect(within(screen.getByTestId("control-panel")).getByTestId("rules-list")).toBe(rules);
        expect(within(rules).getByTestId("rule-quorum")).toHaveTextContent("40% of all members must vote");
        expect(within(rules).getByTestId("rule-deposit")).toHaveTextContent("None");

        fireEvent.click(toggle);
        expect(screen.queryByTestId("rules-list")).toBeNull();
    });

    it("free proposals get no warning", () => {
        renderBox({wallet: WALLET});
        fireEvent.click(screen.getByTestId("rules-toggle"));
        expect(within(screen.getByTestId("rules-list")).getByTestId("rule-cost")).toHaveTextContent("None");
        expect(screen.queryByText(/Proposals are free here/)).toBeNull();
        expect(screen.queryByText("Free proposals")).toBeNull();
    });
});
