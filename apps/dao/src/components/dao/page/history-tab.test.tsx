import {beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";

const nav = vi.hoisted(() => ({search: "tab=history", push: vi.fn(), replace: vi.fn()}));

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(nav.search),
    useRouter: () => ({push: nav.push, replace: nav.replace}),
}));

import type {DaoPageScan} from "@/lib/dao-page-scan";
import type {ScanDaoEvent, ScanDaoEventList} from "@/lib/dao-types";
import type {DaoViewDeps} from "@/lib/dao-view-loader";
import {HistoryTab} from "./history-tab";

const DAO = "bze1daoaddress";
const event = (height: number, type: string, attrs: Record<string, unknown> = {}): ScanDaoEvent =>
    ({height, tx_index: 0, msg_index: 0, seq: 0, type, attrs, tx_hash: `TX${height}`, time: "2026-11-10T09:00:00Z"});

function deps(history: DaoPageScan["history"]): DaoViewDeps {
    return {
        chain: {} as DaoViewDeps["chain"],
        scan: {daoDetail: vi.fn(async () => null), history: vi.fn(history), votesByVoter: vi.fn(async () => ({items: [], next_cursor: null, supported: true}))},
    };
}

function renderTab(d: DaoViewDeps, search = "tab=history") {
    nav.search = search;
    return render(
        <ChakraProvider value={defaultSystem}>
            <HistoryTab deps={d} daoId="2" daoAddress={DAO} nameOf={(a) => (a === "bze1hive" ? "Hive Council" : undefined)} />
        </ChakraProvider>,
    );
}

beforeEach(() => {
    nav.push.mockReset();
    nav.replace.mockReset();
});

describe("the History tab", () => {
    it("starts with the events: no heading, no source line, names instead of DAO numbers", async () => {
        renderTab(deps(async () => ({items: [event(5, "EventAdminChanged", {old_admin: "bze1old", new_admin: "bze1hive"})], next_cursor: null, total: 1})));
        const items = await screen.findAllByTestId("history-item");
        expect(items[0]).toHaveTextContent("New admin: Hive Council");
        const tab = screen.getByTestId("history-tab");
        expect(tab.firstElementChild).toBe(items[0]);
        expect(tab).not.toHaveTextContent(/What happened to this DAO|From BZE Scan|DAO #/);
        expect(within(tab).queryByRole("heading")).toBeNull();
    });

    it("numbered pages with a total: asks for the URL's page, shows the count and pushes the next page", async () => {
        const d = deps(async () => ({items: [event(5, "EventDaoMetadataUpdated")], next_cursor: null, total: 23}));
        renderTab(d, "tab=history&page=2");
        await screen.findAllByTestId("history-item");
        expect(d.scan.history).toHaveBeenCalledWith("2", {page: 2}, 20);
        expect(screen.getByTestId("pagination")).toHaveTextContent("21–21 of 23 events");
        fireEvent.click(within(screen.getByTestId("pager-desktop")).getByRole("button", {name: "Page 1", hidden: true}));
        expect(nav.push).toHaveBeenCalledWith("/dao/2?tab=history", {scroll: false});
        expect(screen.queryByTestId("history-more")).toBeNull();
    });

    it("a page past the end goes to the last page", async () => {
        renderTab(deps(async () => ({items: [], next_cursor: null, total: 23})), "tab=history&page=9");
        await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/dao/2?tab=history&page=2", {scroll: false}));
    });

    it("without a total (an older Scan): Prev / Next over the cursor", async () => {
        const history = vi.fn(async (_id: string, at?: {page?: number; cursor?: string | null}): Promise<ScanDaoEventList> =>
            at?.cursor ? {items: [event(1, "EventDaoCreated", {admin: DAO, address: DAO})], next_cursor: null} : {items: [event(5, "EventDaoMetadataUpdated")], next_cursor: "c1"});
        renderTab(deps(history));
        await screen.findAllByTestId("history-item");
        expect(screen.getByTestId("prev-next")).toHaveTextContent("Page 1");
        fireEvent.click(within(screen.getByTestId("pager-desktop")).getByRole("button", {name: "Next page", hidden: true}));
        expect(await screen.findByText("The DAO was created")).toBeInTheDocument();
        expect(screen.getByText("No admin")).toBeInTheDocument();
        expect(screen.getByTestId("prev-next")).toHaveTextContent("Page 2");
    });

    it("a Scan failure offers a retry that asks again", async () => {
        let fail = true;
        const d = deps(async () => {
            if (fail) throw new Error("down");
            return {items: [event(5, "EventDaoMetadataUpdated")], next_cursor: null, total: 1};
        });
        renderTab(d);
        expect(await screen.findByTestId("scan-retry")).toHaveTextContent("The history");
        fail = false;
        fireEvent.click(screen.getByText("Retry"));
        expect(await screen.findAllByTestId("history-item")).toHaveLength(1);
    });

    it("an empty history says so", async () => {
        renderTab(deps(async () => ({items: [], next_cursor: null, total: 0})));
        expect(await screen.findByTestId("history-empty")).toBeInTheDocument();
    });
});
