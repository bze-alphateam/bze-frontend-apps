import {beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import {getExplorerBaseURL, type Dao} from "@bze/bze-ui-kit";

const nav = vi.hoisted(() => ({search: "", push: vi.fn(), replace: vi.fn(), address: undefined as string | undefined}));

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(nav.search),
    usePathname: () => "/",
    useRouter: () => ({push: nav.push, replace: nav.replace}),
}));
vi.mock("@interchain-kit/react", () => ({useChain: () => ({address: nav.address})}));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({...(await importActual<typeof import("@bze/bze-ui-kit")>()), getChainName: () => "beezee"}));
vi.mock("@/lib/dao-chain", () => ({liveDaoDeps: {}}));

import type {DaoChain, DaoDeps} from "@/lib/dao-loader";
import type {DaoListRequest, DaoScanClient} from "@/lib/dao-scan";
import type {ScanDao, ScanDaoList} from "@/lib/dao-types";
import {Home} from "./home";

const ME = "bze1me";

const scanDao = (id: number, over: Partial<ScanDao> = {}): ScanDao => ({
    id, name: `Dao ${id}`, type: "static_list", address: `bze1dao${id}`, admin: "bze1other", self_governed: false,
    created_time: "2026-11-01T10:00:00Z", proposals_open: id, ...over,
});

const chainDao = (id: number, over: Partial<Dao> = {}): Dao => ({
    id: String(id), address: `bze1dao${id}`, admin: "bze1other", pending_admin: "", type: "DAO_TYPE_STATIC_LIST", name: `Dao ${id}`,
    description: "", config: {} as Dao["config"], members: [], created_at: "1790000000", admin_seq: "0", pending_admin_seq: "0", ...over,
});

const list = (items: ScanDao[], over: Partial<ScanDaoList> = {}): ScanDaoList => ({items, next_cursor: null, supported: true, total: items.length, ...over});

/** The numbered list answers `page` requests; the wallet's filters answer from `mine`. */
function deps(answer: (request: DaoListRequest) => ScanDaoList | Promise<ScanDaoList>, chain: Partial<DaoChain> = {}): DaoDeps & {scan: DaoScanClient; chain: DaoChain} {
    return {
        scan: {listDaos: vi.fn(async (request) => answer(request)), filtersSupported: vi.fn(async () => "yes" as const)},
        chain: {
            isSupported: vi.fn(async () => true),
            getDaos: vi.fn(async () => ({items: [], nextKey: null})),
            getDaosByAdmin: vi.fn(async () => ({items: [], nextKey: null})),
            getDao: vi.fn(async () => null),
            stakingRewardParticipations: vi.fn(async () => []),
            denomRewardParticipations: vi.fn(async () => []),
            ...chain,
        },
    };
}

const isFilter = (r: DaoListRequest) => !!(r.member || r.pendingAdmin || r.sources);

function renderHome(d: DaoDeps, {search = "", address}: {search?: string; address?: string} = {}) {
    nav.search = search;
    nav.address = address;
    return render(
        <ChakraProvider value={defaultSystem}>
            <Home deps={d} />
        </ChakraProvider>,
    );
}

const rows = () => screen.queryAllByTestId("dao-row");
const rowOf = (name: string) => rows().find((r) => within(r).queryByText(name))!;
const roles = (name: string) => within(rowOf(name)).queryAllByTestId("dao-reason").map((e) => e.textContent);

beforeEach(() => {
    nav.push.mockReset();
    nav.replace.mockReset();
    nav.search = "";
    nav.address = undefined;
});

describe("the DAOs table", () => {
    it("lists each DAO with who governs it, its open proposals and its day, linking to its page", async () => {
        renderHome(deps(() => list([scanDao(4, {type: "stake", proposals_open: 2}), scanDao(3, {proposals_open: 0})])));

        await waitFor(() => expect(rows()).toHaveLength(2));
        expect(within(rows()[0]).getByTestId("dao-governed")).toHaveTextContent("Stakers");
        expect(within(rows()[0]).getByTestId("dao-open")).toHaveTextContent("2");
        expect(within(rows()[0]).getByTestId("dao-created")).toHaveTextContent("1 Nov 2026");
        expect(within(rows()[0]).getByTestId("dao-link")).toHaveAttribute("href", "/dao/4");
        expect(within(rows()[1]).getByTestId("dao-governed")).toHaveTextContent("A member list");
        expect(screen.getByTestId("list-count")).toHaveTextContent("2 DAOs");
    });

    it("shows a dash where the open count is unknown (the chain's list)", async () => {
        const d = deps(() => { throw new Error("down"); }, {getDaos: vi.fn(async () => ({items: [chainDao(1)], nextKey: null}))});
        renderHome(d);

        await waitFor(() => expect(rows()).toHaveLength(1));
        expect(within(rows()[0]).getByTestId("dao-open")).toHaveTextContent("—");
    });

    it("has no You column and no My DAOs switch without a wallet", async () => {
        renderHome(deps(() => list([scanDao(1)])));

        await waitFor(() => expect(rows()).toHaveLength(1));
        expect(screen.queryByRole("switch", {hidden: true})).toBeNull();
        expect(screen.queryByText("You")).toBeNull();
        expect(within(rows()[0]).queryByTestId("dao-roles")).toBeNull();
    });

    it("ignores ?mine=1 without a wallet", async () => {
        renderHome(deps(() => list([scanDao(1), scanDao(2)])), {search: "mine=1"});

        await waitFor(() => expect(rows()).toHaveLength(2));
        expect(screen.getByTestId("list-count")).toHaveTextContent("2 DAOs");
    });
});

describe("with a wallet", () => {
    const wallet = (extra: Partial<DaoChain> = {}) => deps(
        (request) => {
            if (request.member) return list([scanDao(3), scanDao(2)]);
            if (isFilter(request)) return list([]);
            return list([scanDao(4), scanDao(3), scanDao(2), scanDao(1)]);
        },
        {getDaosByAdmin: vi.fn(async () => ({items: [chainDao(3), chainDao(1)], nextKey: null})), ...extra},
    );

    it("adds the switch and the You column, one pill per role in a fixed order", async () => {
        renderHome(wallet(), {address: ME});

        await waitFor(() => expect(roles("Dao 3")).toEqual(["Admin", "Member"]));
        expect(screen.getByRole("switch", {name: "My DAOs", hidden: true})).not.toBeChecked();
        expect(screen.getByText("You")).toBeInTheDocument();
        expect(roles("Dao 2")).toEqual(["Member"]);
        expect(roles("Dao 1")).toEqual(["Admin"]);
        expect(roles("Dao 4")).toEqual([]);
    });

    it("leaves the You cells empty while the roles load and when they fail", async () => {
        const d = deps(() => list([scanDao(4)]), {getDaosByAdmin: vi.fn(() => new Promise<never>(() => undefined))});
        renderHome(d, {address: ME});

        await waitFor(() => expect(rows()).toHaveLength(1));
        expect(roles("Dao 4")).toEqual([]);
        expect(screen.queryByText("You")).toBeInTheDocument();
    });

    it("turns My DAOs on in the URL, replacing the entry", async () => {
        renderHome(wallet(), {address: ME, search: "page=2&type=stake"});

        await userEvent.click(await screen.findByRole("switch", {name: "My DAOs", hidden: true}));
        expect(nav.replace).toHaveBeenCalledWith("/?mine=1&type=stake", {scroll: false});
    });

    it("shows only the wallet's DAOs while My DAOs is on, with their count", async () => {
        renderHome(wallet(), {address: ME, search: "mine=1"});

        await waitFor(() => expect(rows()).toHaveLength(3));
        expect(rowOf("Dao 4")).toBeUndefined();
        expect(screen.getByTestId("list-count")).toHaveTextContent("3 of your DAOs");
        expect(screen.getByRole("switch", {name: "My DAOs", hidden: true})).toBeChecked();
    });

    it("filters the wallet's DAOs by type and name in the browser", async () => {
        const d = deps(
            (request) => (request.member ? list([scanDao(3, {type: "stake"}), scanDao(2, {name: "Founders"})]) : isFilter(request) ? list([]) : list([scanDao(3)])),
        );
        renderHome(d, {address: ME, search: "mine=1&type=stake"});

        await waitFor(() => expect(rows()).toHaveLength(1));
        expect(roles("Dao 3")).toEqual(["Member"]);
        expect(screen.getByTestId("list-count")).toHaveTextContent("1 of your DAOs");
    });

    it("pages the wallet's DAOs here, 20 at a time", async () => {
        const many = Array.from({length: 23}, (_, i) => scanDao(i + 1));
        const d = deps((request) => (request.member ? list(many) : isFilter(request) ? list([]) : list([scanDao(1)])));
        renderHome(d, {address: ME, search: "mine=1&page=2"});

        await waitFor(() => expect(rows()).toHaveLength(3));
        expect(screen.getByTestId("list-count")).toHaveTextContent("23 of your DAOs");
        expect(within(screen.getByTestId("pager-desktop")).getByRole("button", {name: "Page 2", hidden: true})).toHaveAttribute("aria-current", "page");
    });

    it("says so when the wallet is in no DAO, and Turn off My DAOs turns the switch off", async () => {
        const d = deps((request) => (isFilter(request) ? list([]) : list([scanDao(1)])));
        renderHome(d, {address: ME, search: "mine=1"});

        expect(await screen.findByText("You're not in any DAO yet")).toBeInTheDocument();
        expect(screen.getByText("My DAOs is on and you're in none of them. Join one by staking in its rewards or by asking its members.")).toBeInTheDocument();
        expect(screen.queryByRole("button", {name: /create/i})).toBeNull();
        expect(screen.queryByRole("button", {name: "Show all DAOs"})).toBeNull();
        await userEvent.click(screen.getByRole("button", {name: "Turn off My DAOs"}));
        expect(nav.replace).toHaveBeenCalledWith("/", {scroll: false});
    });

    it("says nothing matches when a filter leaves none of the wallet's DAOs", async () => {
        const d = deps((request) => (request.member ? list([scanDao(3)]) : isFilter(request) ? list([]) : list([scanDao(1)])));
        renderHome(d, {address: ME, search: "mine=1&type=stake"});

        expect(await screen.findByText("No DAO matches")).toBeInTheDocument();
        expect(screen.getByText("Try another type, or turn off My DAOs.")).toBeInTheDocument();
    });

    it("points at the switch in the No results note when a search leaves none of the wallet's DAOs", async () => {
        const d = deps((request) => (request.member ? list([scanDao(3)]) : isFilter(request) ? list([]) : list([scanDao(1)])));
        renderHome(d, {address: ME, search: "mine=1&q=wasp"});

        const note = await screen.findByTestId("no-results");
        expect(note).toHaveTextContent('No DAO matches "wasp". Search looks at names only, or turn off My DAOs.');
    });

    it("keeps the My DAOs notices for the switch being on", async () => {
        const failing = deps(
            (request) => (isFilter(request) ? list([]) : list([scanDao(1)])),
            {getDaosByAdmin: vi.fn(async () => { throw new Error("rest"); })},
        );
        const {unmount} = renderHome(failing, {address: ME});
        await waitFor(() => expect(rows()).toHaveLength(1));
        expect(screen.queryByText(/could not be read from the chain/)).toBeNull();
        unmount();

        renderHome(failing, {address: ME, search: "mine=1"});
        expect(await screen.findByText(/could not be read from the chain/)).toBeInTheDocument();
    });
});

describe("filters and pages", () => {
    it("starts again at page 1 when a filter changes, replacing the history entry", async () => {
        renderHome(deps(() => list([scanDao(1)], {total: 60})), {search: "page=3"});

        await userEvent.click(await screen.findByRole("button", {name: "Stakers"}));
        expect(nav.replace).toHaveBeenCalledWith("/?type=stake", {scroll: false});
    });

    it("asks Scan for the type and the name, and for the page in the URL", async () => {
        const d = deps(() => list([scanDao(1)], {total: 60}));
        renderHome(d, {search: "page=3&type=stake&q=club"});

        await waitFor(() => expect(rows()).toHaveLength(1));
        expect(d.scan.listDaos).toHaveBeenCalledWith({type: "stake", q: "club", page: 3, limit: 20});
        expect(screen.getByRole("button", {name: "Stakers"})).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByLabelText("Search DAOs by name")).toHaveValue("club");
        expect(screen.getByTestId("list-count")).toHaveTextContent("41–41 of 60 DAOs");
    });

    it("a page change pushes a history entry", async () => {
        renderHome(deps(() => list([scanDao(1)], {total: 100})), {search: "page=3"});

        await userEvent.click(await within(await screen.findByTestId("pager-desktop")).findByRole("button", {name: "Page 4", hidden: true}));
        expect(nav.push).toHaveBeenCalledWith("/?page=4", {scroll: false});
        await userEvent.click(within(screen.getByTestId("pager-desktop")).getByRole("button", {name: "Page 1", hidden: true}));
        expect(nav.push).toHaveBeenLastCalledWith("/", {scroll: false});
    });

    it("writes the search to the URL once typing has paused, and not before", async () => {
        renderHome(deps(() => list([scanDao(1)])));
        await waitFor(() => expect(rows()).toHaveLength(1));

        fireEvent.change(screen.getByLabelText("Search DAOs by name"), {target: {value: "club"}});
        expect(nav.replace).not.toHaveBeenCalled();
        await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/?q=club", {scroll: false}), {timeout: 2000});
    });

    it("does not write anything to the URL at mount", async () => {
        renderHome(deps(() => list([scanDao(1)])), {search: "page=2&q=club"});
        await waitFor(() => expect(rows()).toHaveLength(1));
        await new Promise((resolve) => setTimeout(resolve, 450));
        expect(nav.replace).not.toHaveBeenCalled();
    });

    it("sends no search shorter than two characters", async () => {
        const d = deps(() => list([scanDao(1)]));
        renderHome(d, {search: "q=a"});

        await waitFor(() => expect(rows()).toHaveLength(1));
        expect(d.scan.listDaos).toHaveBeenCalledWith(expect.objectContaining({q: undefined}));
    });

    it("goes to the last page when the page asked is past the end", async () => {
        renderHome(deps((request) => (request.page === 9 ? list([], {total: 23}) : list([scanDao(1)], {total: 23}))), {search: "page=9"});

        await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/?page=2", {scroll: false}));
        expect(screen.queryByText("No DAOs yet")).toBeNull();
    });

    it("says there are no DAOs yet when Scan counts none", async () => {
        renderHome(deps(() => list([], {total: 0})));
        expect(await screen.findByText("No DAOs yet")).toBeInTheDocument();
        expect(screen.getByText("DAOs created on BeeZee are listed here.")).toBeInTheDocument();
    });

    it("says nothing matches when the type filter finds none", async () => {
        renderHome(deps(() => list([], {total: 0})), {search: "type=stake"});
        expect(await screen.findByText("No DAO matches")).toBeInTheDocument();
        expect(screen.getByText("Try another type.")).toBeInTheDocument();
        expect(screen.queryByTestId("no-results")).toBeNull();
    });

    it("names the term in a No results note when the search finds none", async () => {
        renderHome(deps(() => list([], {total: 0})), {search: "q=wasp"});
        const note = await screen.findByTestId("no-results");
        expect(note).toHaveAttribute("role", "note");
        expect(note).toHaveTextContent("No results");
        expect(note).toHaveTextContent('No DAO matches "wasp". Search looks at names only.');
        expect(screen.queryByTestId("no-match")).toBeNull();
    });

    it("keeps the table header and draws four loading rows while the page loads", async () => {
        renderHome(deps(() => new Promise<ScanDaoList>(() => {})));
        await waitFor(() => expect(screen.getAllByTestId("dao-row-skeleton")).toHaveLength(4));
        expect(screen.getAllByTestId("dao-card-skeleton")).toHaveLength(4);
        expect(screen.getByRole("columnheader", {name: "DAO"})).toBeInTheDocument();
        expect(screen.getByRole("group", {name: "DAO type"})).toBeInTheDocument();
    });
});

describe("without totals", () => {
    const older = () => deps((request) => (request.cursor === "c1" ? list([scanDao(1)], {total: null}) : list([scanDao(3), scanDao(2)], {total: null, next_cursor: "c1"})));

    it("moves by Prev and Next, whatever ?page says", async () => {
        const d = older();
        renderHome(d, {search: "page=5"});

        await waitFor(() => expect(rows()).toHaveLength(2));
        expect(screen.getByTestId("list-count")).toHaveTextContent("Page 1");
        const pager = within(screen.getByTestId("pager-desktop"));
        expect(pager.getByRole("button", {name: "Previous page", hidden: true})).toBeDisabled();

        await userEvent.click(pager.getByRole("button", {name: "Next page", hidden: true}));
        await waitFor(() => expect(screen.getByTestId("list-count")).toHaveTextContent("Page 2"));
        expect(rows()).toHaveLength(1);
        expect(d.scan.listDaos).toHaveBeenLastCalledWith(expect.objectContaining({cursor: "c1"}));
        expect(pager.getByRole("button", {name: "Next page", hidden: true})).toBeDisabled();

        await userEvent.click(pager.getByRole("button", {name: "Previous page", hidden: true}));
        await waitFor(() => expect(rows()).toHaveLength(2));
        expect(screen.getByTestId("list-count")).toHaveTextContent("Page 1");
        expect(nav.push).not.toHaveBeenCalled();
    });
});

describe("when Scan is down", () => {
    const down = (getDaos = vi.fn(async () => ({items: [chainDao(2), chainDao(1)], nextKey: null}))) => {
        const answer = vi.fn<(request: DaoListRequest) => ScanDaoList>(() => { throw new Error("down"); });
        return {d: deps(answer, {getDaos}), answer};
    };

    it("shows the Reduced list notice and takes away the type filter and the search", async () => {
        renderHome(down().d);

        await waitFor(() => expect(rows()).toHaveLength(2));
        expect(screen.getByText("Reduced list")).toBeInTheDocument();
        expect(screen.getByTestId("reduced-list")).toHaveTextContent("no open-proposal counts, and pages go ‹ Prev / Next › only. My DAOs shows only DAOs you run.");
        expect(screen.queryByRole("group", {name: "DAO type"})).toBeNull();
        expect(screen.queryByLabelText("Search DAOs by name")).toBeNull();
        expect(screen.getByTestId("list-count")).toHaveTextContent("Page 1");
    });

    it("keeps the type control and the search for the wallet's own list while My DAOs is on", async () => {
        const answer = vi.fn<(request: DaoListRequest) => ScanDaoList>(() => { throw new Error("down"); });
        const d = deps(answer, {getDaos: vi.fn(async () => ({items: [chainDao(2)], nextKey: null})), getDaosByAdmin: vi.fn(async () => ({items: [chainDao(2)], nextKey: null}))});
        renderHome(d, {address: ME, search: "mine=1"});

        await waitFor(() => expect(rows()).toHaveLength(1));
        expect(await screen.findByText("Reduced list")).toBeInTheDocument();
        expect(screen.getByRole("group", {name: "DAO type"})).toBeInTheDocument();
        expect(screen.getByLabelText("Search DAOs by name")).toBeInTheDocument();
    });

    it("Retry reads the list from Scan again", async () => {
        const {d, answer} = down();
        renderHome(d);
        await waitFor(() => expect(rows()).toHaveLength(2));

        answer.mockImplementation(() => list([scanDao(9)], {total: 1}));
        await userEvent.click(screen.getByRole("button", {name: "Retry"}));

        await waitFor(() => expect(screen.queryByText("Reduced list")).toBeNull());
        expect(rows()).toHaveLength(1);
        expect(screen.getByRole("group", {name: "DAO type"})).toBeInTheDocument();
    });

    it("is an error with a Retry when the chain cannot be read either", async () => {
        const {d} = down(vi.fn(async () => { throw new Error("rest"); }));
        renderHome(d);

        expect(await screen.findByText("The DAOs did not load")).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Retry"})).toBeInTheDocument();
    });
});

describe("a node on v8.2.x", () => {
    it("shows the one friendly state and no list", async () => {
        renderHome(deps(() => list([], {supported: false, total: null})));

        expect(await screen.findByText("DAOs arrive with the v8.3.0 network upgrade")).toBeInTheDocument();
        expect(screen.getByText("This network still runs v8.2. Once the upgrade lands, you'll find every DAO here.")).toBeInTheDocument();
        const explorer = screen.getByRole("link", {name: /Open Explorer/});
        expect(explorer).toHaveAttribute("href", getExplorerBaseURL());
        expect(explorer).toHaveAttribute("target", "_blank");
        expect(screen.queryByTestId("daos-section")).toBeNull();
    });
});

describe("the page", () => {
    it("has the hero and the table, and no explainer, open-proposals feed or Create button", async () => {
        renderHome(deps(() => list([scanDao(1)])));

        await waitFor(() => expect(rows()).toHaveLength(1));
        expect(screen.getByRole("heading", {level: 1})).toHaveTextContent("Decide together, on chain.");
        expect(screen.queryByText("What is a DAO on BeeZee?")).toBeNull();
        expect(screen.queryByRole("heading", {name: /open proposals/i})).toBeNull();
        expect(screen.queryByRole("link", {name: /create/i})).toBeNull();
    });

    it("draws the cards for a phone beside the table, each linking to its DAO", async () => {
        renderHome(deps(() => list([scanDao(4, {type: "stake", proposals_open: 0})])));

        const card = await screen.findByTestId("dao-card");
        expect(card).toHaveAttribute("href", "/dao/4");
        expect(within(card).getByTestId("dao-card-governed")).toHaveTextContent("Governed by stakers");
        expect(within(card).getByTestId("dao-card-open")).toHaveTextContent("0");
        expect(card).toHaveTextContent("#4 · Created 1 Nov 2026");
    });
});
