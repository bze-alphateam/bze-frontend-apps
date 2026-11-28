import {beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";

const nav = vi.hoisted(() => ({search: "tab=proposals", push: vi.fn(), replace: vi.fn()}));

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(nav.search),
    useRouter: () => ({push: nav.push, replace: nav.replace}),
}));

import {ScanUnavailableError} from "@/lib/dao-scan";
import {PROPOSAL} from "@/test/proposal-fixtures";
import type {DaoProposalScan, ProposalListRequest} from "@/lib/dao-proposal-scan";
import type {ProposalChain, ProposalDeps} from "@/lib/proposal-loader";
import type {ScanProposalPage, ScanProposalSummary} from "@/lib/proposal-types";
import {ProposalsTab} from "./proposals-tab";

const item = (id: number, status: string, over: Partial<ScanProposalSummary> = {}): ScanProposalSummary => ({
    id, dao_id: 4, title: `Proposal ${id}`, status, proposer: "bze1proposer", proposer_label: null, expedited: false,
    submit_time: null, voting_end: "2026-11-01T00:00:00Z", yes: "75", no: "25", abstain: "0", denominator: "200", settled_height: null, message_types: [],
    ...over,
});

const COUNTS = {voting: 3, execution_failed: 1, executed: 8, rejected: 3, expired: 2, cancelled: 1};

function deps(listForDao: DaoProposalScan["listForDao"], chain: Partial<ProposalChain> = {}): ProposalDeps {
    return {
        scan: {listForDao: vi.fn(listForDao), detail: vi.fn(async () => null), votes: vi.fn(async () => null)},
        chain: {getDaoProposals: vi.fn(async () => ({items: [], nextKey: null})), ...chain} as unknown as ProposalChain,
    };
}

const numbered = (items: ScanProposalSummary[], total: number, counts: Record<string, number> | null = COUNTS) =>
    async (): Promise<ScanProposalPage> => ({items, next_cursor: null, total, status_counts: counts});

function renderTab(d: ProposalDeps, {search = "tab=proposals", newProposal = false} = {}) {
    nav.search = search;
    return render(
        <ChakraProvider value={defaultSystem}>
            <ProposalsTab deps={d} daoId="4" nameOf={(a) => (a === "bze1proposer" ? "Alice" : undefined)} newProposal={newProposal} />
        </ChakraProvider>,
    );
}

const table = () => screen.getByTestId("proposal-table");

beforeEach(() => {
    nav.push.mockReset();
    nav.replace.mockReset();
});

describe("the Proposals tab", () => {
    it("is one table (and phone cards) with #, the proposal and who proposed it, the status, Yes · turnout and When", async () => {
        renderTab(deps(numbered([item(9, "voting", {expedited: true, voting_end: "2099-01-01T00:00:00Z"})], 1)));
        const rows = await within(table()).findAllByTestId("proposal-row");
        expect(rows).toHaveLength(1);
        expect(rows[0]).toHaveTextContent("#9");
        expect(within(rows[0]).getByTestId("proposal-link")).toHaveAttribute("href", "/proposal/9");
        expect(within(rows[0]).getByTestId("row-proposer")).toHaveTextContent("by Alice");
        expect(within(rows[0]).getByTestId("row-status")).toHaveTextContent(/^Voting$/);
        expect(within(rows[0]).getByTestId("row-status")).toHaveAttribute("data-status", "voting");
        expect(within(rows[0]).getByTestId("row-expedited")).toHaveTextContent("Expedited");
        // one "Yes · turnout" column, not two
        expect(within(rows[0]).getByTestId("row-result")).toHaveTextContent("75 % · 50 %");
        expect(within(rows[0]).queryByTestId("row-yes")).toBeNull();
        expect(within(table()).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["#", "Proposal", "Status", "Yes · turnout", "When"]);
        expect(within(rows[0]).getByTestId("row-ends")).toHaveTextContent(/^Ends in \d+ days$/);
        expect(screen.getAllByTestId("proposal-card")).toHaveLength(1);
        expect(screen.queryByText("Load more")).toBeNull();
    });

    it("the status pills use the board's words: ready to settle, passed (executed or failed), and the finished ones", async () => {
        renderTab(deps(numbered([
            item(1, "voting", {voting_end: "2020-01-01T00:00:00Z"}), item(2, "execution_failed"), item(3, "executed"),
            item(4, "rejected"), item(5, "expired"), item(6, "cancelled"),
        ], 6)));
        const rows = await within(table()).findAllByTestId("proposal-row");
        expect(rows.map((r) => within(r).getByTestId("row-status").textContent)).toEqual([
            "Ready to settle", "Passed · execution failed", "Passed · executed", "Rejected", "Expired", "Cancelled",
        ]);
        expect(within(rows[0]).getByTestId("row-ends")).toHaveTextContent(/^Voting ended /);
        expect(within(rows[2]).getByTestId("row-ends")).toHaveTextContent("Voting ended 1 Nov 2026");
    });

    it("the status segments carry Scan's counts: Active = voting + execution failed, All the sum", async () => {
        renderTab(deps(numbered([item(9, "voting")], 18)));
        await within(table()).findAllByTestId("proposal-row");
        const count = (v: string) => within(screen.getByTestId(`status-${v}`)).getByTestId("status-count").textContent;
        expect(["all", "active", "passed", "rejected", "expired", "cancelled"].map(count)).toEqual(["18", "4", "8", "3", "2", "1"]);
        expect(screen.getByTestId("status-all")).toHaveAttribute("aria-pressed", "true");
    });

    it("without status_counts the segments have no numbers", async () => {
        renderTab(deps(numbered([item(9, "voting")], 1, null)));
        await within(table()).findAllByTestId("proposal-row");
        expect(screen.getByTestId("status-active")).toHaveTextContent("Active");
        expect(screen.queryAllByTestId("status-count")).toHaveLength(0);
    });

    it("asks Scan for the filter and the page in the URL", async () => {
        const d = deps(numbered([item(9, "voting")], 30));
        renderTab(d, {search: "tab=proposals&status=active&page=2"});
        await within(table()).findAllByTestId("proposal-row");
        expect(d.scan.listForDao).toHaveBeenCalledWith("4", {statuses: ["active"], page: 2, limit: 20});
        expect(screen.getByTestId("status-active")).toHaveAttribute("aria-pressed", "true");
    });

    it("a status change replaces the URL and starts at page 1, keeping tab=proposals", async () => {
        renderTab(deps(numbered([item(9, "voting")], 30)), {search: "tab=proposals&page=2"});
        await within(table()).findAllByTestId("proposal-row");
        fireEvent.click(screen.getByTestId("status-rejected"));
        expect(nav.replace).toHaveBeenCalledWith("/dao/4?tab=proposals&status=rejected", {scroll: false});
    });

    it("under All the active rows come first, tinted, with the rule after the last one", async () => {
        renderTab(deps(numbered([item(9, "voting"), item(10, "execution_failed"), item(11, "rejected"), item(5, "cancelled")], 4)));
        const rows = await within(table()).findAllByTestId("proposal-row");
        expect(rows.map((r) => r.getAttribute("data-active"))).toEqual(["true", "true", null, null]);
        expect(rows.map((r) => r.getAttribute("data-rule"))).toEqual([null, "after", null, null]);
    });

    it("under another status the active rows keep their tint, with no rule", async () => {
        renderTab(deps(numbered([item(9, "voting"), item(10, "execution_failed")], 2)), {search: "tab=proposals&status=active"});
        const rows = await within(table()).findAllByTestId("proposal-row");
        expect(rows.map((r) => r.getAttribute("data-active"))).toEqual(["true", "true"]);
        expect(rows.every((r) => r.getAttribute("data-rule") === null)).toBe(true);
    });

    it("numbered pages with a total: the count line and a pushed page", async () => {
        renderTab(deps(numbered(Array.from({length: 20}, (_, i) => item(40 - i, "executed")), 45)));
        await within(table()).findAllByTestId("proposal-row");
        expect(screen.getByTestId("pagination")).toHaveTextContent("1–20 of 45 proposals");
        fireEvent.click(within(screen.getByTestId("pager-desktop")).getByRole("button", {name: "Page 3", hidden: true}));
        expect(nav.push).toHaveBeenCalledWith("/dao/4?tab=proposals&page=3", {scroll: false});
    });

    it("a page past the end goes to the last page, keeping the status", async () => {
        renderTab(deps(numbered([], 23)), {search: "tab=proposals&status=passed&page=9"});
        await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/dao/4?tab=proposals&status=passed&page=2", {scroll: false}));
        expect(screen.queryByText("No proposals with this status")).toBeNull();
    });

    it("without a total (an older Scan): Prev / Next over next_cursor only", async () => {
        const listForDao = vi.fn(async (_id: string, request: ProposalListRequest): Promise<ScanProposalPage> =>
            request.cursor ? {items: [item(3, "rejected")], next_cursor: null} : {items: [item(9, "executed")], next_cursor: "c1"});
        const d = deps(listForDao);
        renderTab(d);
        await within(table()).findAllByTestId("proposal-row");
        expect(screen.queryByTestId("pagination")).toBeNull();
        expect(screen.getByTestId("prev-next")).toHaveTextContent("Page 1");
        fireEvent.click(within(screen.getByTestId("pager-desktop")).getByRole("button", {name: "Next page", hidden: true}));
        await waitFor(() => expect(within(table()).getByTestId("proposal-row")).toHaveTextContent("#3"));
        expect(d.scan.listForDao).toHaveBeenLastCalledWith("4", {statuses: [], cursor: "c1", limit: 20});
        expect(nav.push).not.toHaveBeenCalled();
    });

    it("Scan down: Active lists the chain's live proposals, with Prev / Next by key", async () => {
        const getDaoProposals = vi.fn(async () => ({items: [{...PROPOSAL, id: "6", title: "From the chain"}], nextKey: "k2"}));
        renderTab(deps(async () => { throw new ScanUnavailableError("down"); }, {getDaoProposals}), {search: "tab=proposals&status=active"});
        expect(await within(table()).findByText("From the chain")).toBeInTheDocument();
        expect(screen.getByText(/read from the chain/)).toBeInTheDocument();
        expect(screen.getByTestId("prev-next")).toBeInTheDocument();
        expect(screen.queryAllByTestId("status-count")).toHaveLength(0);
    });

    it("Scan down: the other statuses say they need BZE Scan", async () => {
        renderTab(deps(async () => { throw new ScanUnavailableError("down"); }), {search: "tab=proposals&status=passed"});
        expect(await screen.findByTestId("needs-scan")).toHaveTextContent("needs BZE Scan");
        expect(screen.queryByTestId("proposal-table")).toBeNull();
        fireEvent.click(screen.getByText("Show the active ones"));
        expect(nav.replace).toHaveBeenCalledWith("/dao/4?tab=proposals&status=active", {scroll: false});
    });

    it("an empty status says so", async () => {
        renderTab(deps(numbered([], 0)), {search: "tab=proposals&status=expired"});
        expect(await screen.findByText("No proposals with this status")).toBeInTheDocument();
        expect(screen.getByTestId("proposals-empty")).toHaveTextContent("Pick another status, or All.");
    });

    it("New proposal sits next to the filter, only when offered", async () => {
        const {unmount} = renderTab(deps(numbered([item(9, "voting")], 1)), {newProposal: true});
        await within(table()).findAllByTestId("proposal-row");
        expect(screen.getByTestId("new-proposal")).toHaveAttribute("href", "/dao/4/propose");
        expect(screen.getByTestId("status-filter").parentElement?.parentElement).toContainElement(screen.getByTestId("new-proposal"));
        unmount();
        renderTab(deps(numbered([item(9, "voting")], 1)));
        await within(table()).findAllByTestId("proposal-row");
        expect(screen.queryByTestId("new-proposal")).toBeNull();
    });
});
