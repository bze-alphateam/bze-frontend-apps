import {expect, test} from "./support/mock-network";

// The Proposals tab of a DAO page: one table with a status filter and numbered pages. DAO 4 "Stakers club":
// 9 is in voting (expedited), 10 passed with failed actions (both Active), 11 was rejected and 5 cancelled.
// Scan answers numbered pages active first, with `total` and `status_counts`.
const SCAN_PROPOSALS = "/api/scan/daos/4/proposals";

test("All lists the active proposals first, tinted and ruled off, with the counts on the segments", async ({page}) => {
    await page.goto("/dao/4");
    await page.getByTestId("dao-tab-proposals").click();

    const rows = page.getByTestId("proposal-row");
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText("Fund the hive festival");
    await expect(rows.nth(0).getByTestId("row-status")).toHaveText("Voting");
    await expect(rows.nth(0).getByTestId("row-expedited")).toBeVisible();
    await expect(rows.nth(0).getByTestId("row-yes")).toHaveText("93.75%");
    await expect(rows.nth(0).getByTestId("row-turnout")).toHaveText("80%");
    await expect(rows.nth(0).getByTestId("proposal-link")).toHaveAttribute("href", "/proposal/9");
    await expect(rows.nth(1).getByTestId("row-status")).toHaveText("Execution failed");
    await expect(rows.nth(1)).toHaveAttribute("data-rule", "after");
    await expect(rows.nth(2)).toContainText("Old honey budget");
    await expect(rows.nth(2)).not.toHaveAttribute("data-active", "true");
    await expect(rows.nth(3).getByTestId("row-status")).toHaveText("Cancelled");

    await expect(page.getByTestId("status-all").getByTestId("status-count")).toHaveText("4");
    await expect(page.getByTestId("status-active").getByTestId("status-count")).toHaveText("2");
    await expect(page.getByTestId("status-passed").getByTestId("status-count")).toHaveText("0");
    await expect(page.getByTestId("list-count")).toHaveText("4 proposals");
    await expect(page.getByText("Load more")).toHaveCount(0);
});

test("a status filter goes into the URL next to the tab and starts at page 1", async ({page}) => {
    await page.goto("/dao/4?tab=proposals");
    await page.getByTestId("status-active").click();
    await expect(page).toHaveURL(/\/dao\/4\?tab=proposals&status=active$/);
    await expect(page.getByTestId("proposal-row")).toHaveCount(2);
    await expect(page.getByTestId("status-active")).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("status-rejected").click();
    await expect(page).toHaveURL(/\/dao\/4\?tab=proposals&status=rejected$/);
    await expect(page.getByTestId("proposal-row")).toHaveCount(1);
    await expect(page.getByTestId("proposal-row")).toContainText("Old honey budget");

    // a link opens the same view
    await page.goto("/dao/4?tab=proposals&status=active");
    await expect(page.getByTestId("proposal-row")).toHaveCount(2);
});

test("numbered pages: the page goes into the URL and Back returns to the one before", async ({page, network}) => {
    const row = (id: number) => ({
        id, dao_id: 4, title: `Rejected idea ${id}`, status: "rejected", proposer: "bze1qqqpkg3fxqmnu32v2ddxz6r0we7cfzuju395lw", proposer_label: null,
        expedited: false, submit_time: "2026-10-27T11:20:00Z", voting_end: "2026-10-30T11:20:00Z", yes: "1", no: "4", abstain: "0",
        denominator: "10", settled_height: 1500, message_types: [],
    });
    network.use("scan", {path: SCAN_PROPOSALS, query: {page: "1", limit: "20"}, status: 200, body: {
        items: Array.from({length: 20}, (_, i) => row(40 - i)), next_cursor: null, total: 25,
    }});
    network.use("scan", {path: SCAN_PROPOSALS, query: {page: "2", limit: "20"}, status: 200, body: {
        items: Array.from({length: 5}, (_, i) => row(20 - i)), next_cursor: null, total: 25,
    }});

    await page.goto("/dao/4?tab=proposals");
    await expect(page.getByTestId("list-count")).toHaveText("1–20 of 25 proposals");
    await page.getByTestId("pager-desktop").getByRole("button", {name: "Page 2"}).click();
    await expect(page).toHaveURL(/\/dao\/4\?tab=proposals&page=2$/);
    await expect(page.getByTestId("proposal-row")).toHaveCount(5);
    await expect(page.getByTestId("list-count")).toHaveText("21–25 of 25 proposals");

    await page.goBack();
    await expect(page).toHaveURL(/\/dao\/4\?tab=proposals$/);
    await expect(page.getByTestId("proposal-row")).toHaveCount(20);
});

test("an older Scan (no total, no `active`): Prev / Next, no counts, and Active from its two statuses", async ({page, network}) => {
    // it ignores `page` and answers its first cursor page, newest first; `status=active` it refuses
    network.use("scan", {path: SCAN_PROPOSALS, query: {page: "1", limit: "20"}, status: 200, body: {
        items: [
            {id: 10, dao_id: 4, title: "Pay the beekeepers", status: "execution_failed", proposer: "bze1qqqpkg3fxqmnu32v2ddxz6r0we7cfzuju395lw", proposer_label: null, expedited: false, submit_time: null, voting_end: "2026-10-30T11:20:00Z", yes: "6", no: "1", abstain: "0", denominator: "10", settled_height: null, message_types: []},
            {id: 4, dao_id: 4, title: null, status: null, proposer: null, proposer_label: null, expedited: null, submit_time: null, voting_end: null, yes: null, no: null, abstain: null, denominator: null, settled_height: null, message_types: []},
        ],
        next_cursor: null,
    }});
    network.use("scan", {path: SCAN_PROPOSALS, query: {status: "active", limit: "20"}, status: 400, body: {error: "unknown status"}});

    await page.goto("/dao/4?tab=proposals");
    await expect(page.getByTestId("proposal-row")).toHaveCount(1);
    await expect(page.getByTestId("prev-next")).toContainText("Page 1");
    await expect(page.getByTestId("pagination")).toHaveCount(0);
    await expect(page.getByTestId("status-count")).toHaveCount(0);

    await page.getByTestId("status-active").click();
    const rows = page.getByTestId("proposal-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Fund the hive festival");
    await expect(rows.nth(1)).toContainText("Pay the beekeepers");
});

test("with Scan down All needs BZE Scan and Active falls back to the chain", async ({page, network}) => {
    network.use("scan", {path: SCAN_PROPOSALS, query: {page: "1", limit: "20"}, status: 502, body: {error: "BZE Scan unavailable"}});
    network.use("scan", {path: SCAN_PROPOSALS, query: {status: "active", page: "1", limit: "20"}, status: 502, body: {error: "BZE Scan unavailable"}});

    await page.goto("/dao/4?tab=proposals");
    await expect(page.getByTestId("needs-scan")).toContainText("needs BZE Scan");
    await expect(page.getByTestId("proposal-row")).toHaveCount(0);

    await page.getByText("Show the active ones").click();
    await expect(page).toHaveURL(/status=active/);
    await expect(page.getByText("read from the chain")).toBeVisible();
    const rows = page.getByTestId("proposal-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Fund the hive festival");
    await expect(rows.nth(1)).toContainText("Pay the beekeepers");
    await expect(page.getByTestId("prev-next")).toBeVisible();
});

test("a status with no proposals says so", async ({page, network}) => {
    network.use("scan", {path: SCAN_PROPOSALS, query: {status: "rejected", page: "1", limit: "20"}, status: 200, body: {items: [], next_cursor: null, total: 0}});
    await page.goto("/dao/4?tab=proposals&status=rejected");
    await expect(page.getByText("No proposals with this status")).toBeVisible();
});
