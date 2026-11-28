import {describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import type {DaoBallot} from "@bze/bze-ui-kit";
import {ScanUnavailableError} from "@/lib/dao-scan";
import type {DaoProposalScan} from "@/lib/dao-proposal-scan";
import type {ProposalChain, ProposalDeps} from "@/lib/proposal-loader";
import type {ScanVote, ScanVoteList} from "@/lib/proposal-types";
import {VotesPanel} from "./votes-panel";

const vote = (n: number, option = "yes"): ScanVote => ({
    voter: `bze1voter${String(n).padStart(3, "0")}`, voter_label: null, option, weight: "1", effective_weight: "1", height: 1, tx_hash: null, time: "2026-11-01T00:00:00Z",
});
const rows = (from: number, count: number) => Array.from({length: count}, (_, i) => vote(from + i));
const COUNTS = {yes: 150, no: 50, abstain: 14};

function deps(votes: DaoProposalScan["votes"], chain: Partial<ProposalChain> = {}): ProposalDeps {
    return {
        chain: {getBallots: vi.fn(async () => ({items: [], nextKey: null})), ...chain} as unknown as ProposalChain,
        scan: {listForDao: vi.fn(), detail: vi.fn(), votes: vi.fn(votes)} as unknown as DaoProposalScan,
    };
}

const renderPanel = (d: ProposalDeps, daoType = "DAO_TYPE_STAKE") =>
    render(
        <ChakraProvider value={defaultSystem}>
            <VotesPanel deps={d} proposalId="7" daoType={daoType} formatWeight={(a) => `${a} BZE`} />
        </ChakraProvider>,
    );

const count = () => screen.getByTestId("list-count").textContent;

describe("VotesPanel", () => {
    it("numbered pages with Scan's total: the count line, the pager, and a page change reads that page", async () => {
        const votes = vi.fn(async (_id: string, request: {page?: number}): Promise<ScanVoteList> => ({
            items: rows(((request.page ?? 1) - 1) * 20, 20), next_cursor: null, weight_denom: null, total: 214, option_counts: COUNTS,
        }));
        const d = deps(votes);
        renderPanel(d);

        await waitFor(() => expect(screen.getAllByTestId("vote-row")).toHaveLength(20));
        expect(count()).toBe("1–20 of 214 votes");
        const pager = screen.getByTestId("pager-desktop");
        expect(within(pager).getByRole("button", {name: "Page 11", hidden: true})).toBeTruthy();

        fireEvent.click(within(pager).getByRole("button", {name: "Page 2", hidden: true}));
        await waitFor(() => expect(count()).toBe("21–40 of 214 votes"));
        expect(votes).toHaveBeenLastCalledWith("7", {option: null, page: 2, limit: 20});
        expect(screen.queryByText(/From BZE Scan/)).toBeNull();
    });

    it("the option filter shows Scan's counts, reads that option and starts again at page 1", async () => {
        const votes = vi.fn(async (_id: string, request: {option: string | null; page?: number}): Promise<ScanVoteList> => ({
            items: rows(0, 3), next_cursor: null, weight_denom: null, total: request.option === "no" ? 50 : 214, option_counts: COUNTS,
        }));
        const d = deps(votes);
        renderPanel(d);

        await waitFor(() => expect(screen.getAllByTestId("vote-filter-count").map((c) => c.textContent)).toEqual(["214", "150", "50", "14"]));
        fireEvent.click(within(screen.getByTestId("pager-desktop")).getByRole("button", {name: "Page 2", hidden: true}));
        await waitFor(() => expect(votes).toHaveBeenLastCalledWith("7", {option: null, page: 2, limit: 20}));

        fireEvent.click(screen.getByRole("tab", {name: /^No/}));
        await waitFor(() => expect(votes).toHaveBeenLastCalledWith("7", {option: "no", page: 1, limit: 20}));
        // the counts stay while the filtered page loads, and after
        expect(screen.getAllByTestId("vote-filter-count")).toHaveLength(4);
    });

    it("no counts on the filter without Scan's option_counts", async () => {
        renderPanel(deps(async () => ({items: rows(0, 2), next_cursor: null, weight_denom: null, total: 2})));
        await waitFor(() => expect(screen.getAllByTestId("vote-row")).toHaveLength(2));
        expect(screen.queryByTestId("vote-filter-count")).toBeNull();
    });

    it("an older Scan without a total: Prev / Next driven by next_cursor", async () => {
        const votes = vi.fn(async (_id: string, request: {cursor?: string | null}): Promise<ScanVoteList> =>
            request.cursor === "c2"
                ? {items: rows(20, 5), next_cursor: null, weight_denom: null}
                : {items: rows(0, 20), next_cursor: "c2", weight_denom: null});
        renderPanel(deps(votes));

        await waitFor(() => expect(screen.getAllByTestId("vote-row")).toHaveLength(20));
        expect(count()).toBe("Page 1");
        expect(screen.queryByTestId("pagination")).toBeNull();
        fireEvent.click(within(screen.getByTestId("pager-desktop")).getByRole("button", {name: "Next page", hidden: true}));
        await waitFor(() => expect(screen.getAllByTestId("vote-row")).toHaveLength(5));
        expect(votes).toHaveBeenLastCalledWith("7", {option: null, cursor: "c2", limit: 20});
        expect(count()).toBe("Page 2");
    });

    it("with Scan down: the chain's ballots, the notice, Prev / Next by key", async () => {
        const ballot = (voter: string): DaoBallot => ({proposal_id: "7", voter, option: "YES", weight: "3", shares: []});
        const getBallots = vi.fn(async (_id: string, page: {key?: string}) =>
            page.key ? {items: [ballot("bze1b")], nextKey: null} : {items: [ballot("bze1a")], nextKey: "k2"});
        renderPanel(deps(async () => { throw new ScanUnavailableError("down"); }, {getBallots}));

        await waitFor(() => expect(screen.getAllByTestId("vote-row")).toHaveLength(1));
        expect(screen.getByText(/read from the chain: in voter order, without names/)).toBeTruthy();
        expect(screen.getByTestId("prev-next")).toBeTruthy();
        fireEvent.click(within(screen.getByTestId("pager-desktop")).getByRole("button", {name: "Next page", hidden: true}));
        await waitFor(() => expect(getBallots).toHaveBeenLastCalledWith("7", {key: "k2", limit: 20}));
    });

    it("a member list whose votes fit on one page: '<n> votes · one vote per member', no pager", async () => {
        renderPanel(deps(async () => ({items: rows(0, 2), next_cursor: null, weight_denom: null, total: 2, option_counts: {yes: 2, no: 0, abstain: 0}})), "DAO_TYPE_STATIC_LIST");
        await waitFor(() => expect(count()).toBe("2 votes · one vote per member"));
        expect(screen.queryByTestId("pager-desktop")).toBeNull();
    });

    it("a member list with more than one page keeps the pager; a stake DAO never says 'per member'", async () => {
        const many = async (): Promise<ScanVoteList> => ({items: rows(0, 20), next_cursor: null, weight_denom: null, total: 25});
        const {unmount} = renderPanel(deps(many), "DAO_TYPE_STATIC_LIST");
        await waitFor(() => expect(count()).toBe("1–20 of 25 votes"));
        unmount();
        renderPanel(deps(async () => ({items: rows(0, 2), next_cursor: null, weight_denom: null, total: 2})));
        await waitFor(() => expect(count()).toBe("2 votes"));
    });

    it("a member list under a filter judges 'one vote per member' on every option's votes, not the filtered total", async () => {
        const votes = vi.fn(async (_id: string, request: {option: string | null}): Promise<ScanVoteList> => ({
            items: rows(0, request.option === "yes" ? 5 : 20), next_cursor: null, weight_denom: null,
            total: request.option === "yes" ? 5 : 45, option_counts: {yes: 5, no: 40, abstain: 0},
        }));
        renderPanel(deps(votes), "DAO_TYPE_STATIC_LIST");
        await waitFor(() => expect(count()).toBe("1–20 of 45 votes"));
        fireEvent.click(screen.getByRole("tab", {name: /^Yes/}));
        await waitFor(() => expect(count()).toBe("5 votes"));
    });

    it("a filter change starts at page 1, also when going back to a filter seen before", async () => {
        const votes = vi.fn(async (): Promise<ScanVoteList> => ({items: rows(0, 20), next_cursor: null, weight_denom: null, total: 60, option_counts: {yes: 60, no: 0, abstain: 0}}));
        renderPanel(deps(votes));
        await waitFor(() => expect(count()).toBe("1–20 of 60 votes"));
        fireEvent.click(within(screen.getByTestId("pager-desktop")).getByRole("button", {name: "Page 2", hidden: true}));
        await waitFor(() => expect(count()).toBe("21–40 of 60 votes"));

        fireEvent.click(screen.getByRole("tab", {name: /^Yes/}));
        await waitFor(() => expect(votes).toHaveBeenLastCalledWith("7", {option: "yes", page: 1, limit: 20}));
        fireEvent.click(screen.getByRole("tab", {name: /^All/}));
        await waitFor(() => expect(votes).toHaveBeenLastCalledWith("7", {option: null, page: 1, limit: 20}));
        await waitFor(() => expect(count()).toBe("1–20 of 60 votes"));
    });

    it("a late answer of the filter left behind never replaces the rows of the one picked", async () => {
        let releaseAll: (list: ScanVoteList) => void = () => {};
        const votes = vi.fn((_id: string, request: {option: string | null}): Promise<ScanVoteList> =>
            request.option === null
                ? new Promise((resolve) => { releaseAll = resolve; })
                : Promise.resolve({items: [vote(900, "no")], next_cursor: null, weight_denom: null, total: 1, option_counts: {yes: 3, no: 1, abstain: 0}}));
        renderPanel(deps(votes));
        await waitFor(() => expect(votes).toHaveBeenCalledTimes(1));

        fireEvent.click(screen.getByRole("tab", {name: /^No/}));
        await waitFor(() => expect(screen.getAllByTestId("vote-row")).toHaveLength(1));
        releaseAll({items: rows(0, 4), next_cursor: null, weight_denom: null, total: 4, option_counts: {yes: 3, no: 1, abstain: 0}});
        await new Promise((r) => setTimeout(r, 20));
        expect(screen.getAllByTestId("vote-row")).toHaveLength(1);
        expect(screen.getByTestId("vote-option")).toHaveTextContent("No");
        expect(count()).toBe("1 vote");
    });

    it("a page past the end (the votes got fewer) goes to the last page", async () => {
        const votes = vi.fn(async (_id: string, request: {page?: number}): Promise<ScanVoteList> =>
            request.page === 3
                ? {items: [], next_cursor: null, weight_denom: null, total: 30}
                : {items: rows(((request.page ?? 1) - 1) * 20, request.page === 2 ? 10 : 20), next_cursor: null, weight_denom: null, total: request.page === 2 ? 30 : 50});
        renderPanel(deps(votes));
        await waitFor(() => expect(count()).toBe("1–20 of 50 votes"));
        fireEvent.click(within(screen.getByTestId("pager-desktop")).getByRole("button", {name: "Page 3", hidden: true}));
        await waitFor(() => expect(votes).toHaveBeenLastCalledWith("7", {option: null, page: 2, limit: 20}));
        await waitFor(() => expect(count()).toBe("21–30 of 30 votes"));
    });

    it("a member list read from the chain (Scan down) on one page still says one vote per member", async () => {
        const getBallots = vi.fn(async () => ({items: [{proposal_id: "7", voter: "bze1a", option: "YES", weight: "1", shares: []} as DaoBallot], nextKey: null}));
        renderPanel(deps(async () => { throw new ScanUnavailableError("down"); }, {getBallots}), "DAO_TYPE_STATIC_LIST");
        await waitFor(() => expect(count()).toBe("1 vote · one vote per member"));
        expect(screen.getByText(/read from the chain/)).toBeTruthy();
    });
});
