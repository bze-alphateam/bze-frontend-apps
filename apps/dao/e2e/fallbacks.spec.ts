import {expect, test} from "./support/mock-network";
import {fourChainDaos, fourScanDaos, SCAN_DAOS} from "./support/home-fixtures";

// The states of the home page when Scan or the node cannot serve the list.

const FIRST_PAGE = {page: "1", limit: "20"};
const SCAN_DOWN = {status: 502, body: {error: "BZE Scan unavailable"}};
const CHAIN_DAOS = "/bze/dao/daos";

test("a node on v8.2.x shows one friendly state instead of the list", async ({page, network}) => {
    network.use("scan", {path: SCAN_DAOS, query: FIRST_PAGE, status: 200, body: {items: [], next_cursor: null, supported: false}});
    await page.goto("/");

    await expect(page.getByText("DAOs arrive with the v8.3.0 network upgrade")).toBeVisible();
    await expect(page.getByTestId("dao-row")).toHaveCount(0);
    await expect(page.getByRole("heading", {name: "DAOs", exact: true})).toHaveCount(0);
});

test("with Scan down the list falls back to the chain: a Reduced list notice, no filters, no open counts", async ({page, network}) => {
    network.use("scan", {path: SCAN_DAOS, query: FIRST_PAGE, ...SCAN_DOWN});
    await page.goto("/");

    await expect(page.getByText("Reduced list")).toBeVisible();
    await expect(page.getByText("BZE Scan isn't answering")).toBeVisible();
    const rows = page.getByTestId("dao-row");
    await expect(rows).toHaveCount(4);
    // the chain lists the newest first and knows nothing of open proposals
    await expect(rows.first()).toContainText("Stakers club");
    await expect(page.getByTestId("dao-open")).toHaveText(["—", "—", "—", "—"]);
    // ... and cannot filter
    await expect(page.getByRole("group", {name: "DAO type"})).toHaveCount(0);
    await expect(page.getByLabel("Search DAOs by name")).toHaveCount(0);
    // one page of the chain: Prev and Next are both off
    await expect(page.getByTestId("list-count")).toHaveText("Page 1");
});

test("the chain's pages are read with Prev and Next, and Retry asks Scan again", async ({page, network}) => {
    const [first, ...rest] = fourChainDaos();
    network.use("scan", {path: SCAN_DAOS, query: FIRST_PAGE, ...SCAN_DOWN});
    network.use("lcd", {path: CHAIN_DAOS, query: {"pagination.limit": "50", "pagination.reverse": "true"}, status: 200, body: {daos: [first], pagination: {next_key: "azI=", total: "0"}}});
    network.use("lcd", {path: CHAIN_DAOS, query: {"pagination.key": "azI=", "pagination.limit": "50", "pagination.reverse": "true"}, status: 200, body: {daos: rest, pagination: {next_key: null, total: "0"}}});
    await page.goto("/");

    const rows = page.getByTestId("dao-row");
    const pager = page.getByRole("navigation", {name: "Pages"});
    await expect(rows).toHaveCount(1);
    await expect(page.getByTestId("list-count")).toHaveText("Page 1");
    await expect(pager.getByRole("button", {name: "Previous page"})).toBeDisabled();

    await pager.getByRole("button", {name: "Next page"}).click();
    await expect(rows).toHaveCount(3);
    await expect(page.getByTestId("list-count")).toHaveText("Page 2");
    await expect(pager.getByRole("button", {name: "Next page"})).toBeDisabled();
    await expect(pager.getByRole("button", {name: "Previous page"})).toBeEnabled();

    await pager.getByRole("button", {name: "Previous page"}).click();
    await expect(rows).toHaveCount(1);
    await expect(page.getByTestId("list-count")).toHaveText("Page 1");

    // Scan is back: Retry reads it again and the list is numbered
    network.use("scan", {path: SCAN_DAOS, query: FIRST_PAGE, status: 200, body: {items: fourScanDaos(), next_cursor: null, supported: true, total: 4}});
    await page.getByRole("button", {name: "Retry"}).click();
    await expect(rows).toHaveCount(4);
    await expect(page.getByText("Reduced list")).toHaveCount(0);
    await expect(page.getByTestId("dao-open").first()).toHaveText("2");
});

test("with Scan down and a v8.2.x node the list is the friendly state, not an error", async ({page, network}) => {
    network.use("scan", {path: SCAN_DAOS, query: FIRST_PAGE, ...SCAN_DOWN});
    network.use("lcd", {path: "/bze/dao/params", status: 501, body: {code: 12, message: "unknown service bze.dao.Query", details: []}});
    await page.goto("/");

    await expect(page.getByText("DAOs arrive with the v8.3.0 network upgrade")).toBeVisible();
});

test("Scan and the chain both failing is an error with a Retry", async ({page, network}) => {
    network.use("scan", {path: SCAN_DAOS, query: FIRST_PAGE, ...SCAN_DOWN});
    network.use("lcd", {path: CHAIN_DAOS, query: {"pagination.limit": "50", "pagination.reverse": "true"}, status: 502, body: {code: 14, message: "unavailable"}});
    await page.goto("/");

    await expect(page.getByText("The DAOs did not load")).toBeVisible();
    await expect(page.getByRole("button", {name: "Retry"})).toBeVisible();
});

test("a Scan without the BFE-368 filters: the search runs on the page", async ({page, network}) => {
    // Scan ignores the unknown `member` parameter and answers the whole list: that is how an older Scan reads
    network.use("scan", {path: SCAN_DAOS, query: {member: "not-an-address", limit: "1"}, status: 200, body: {items: [], next_cursor: null, supported: true}});
    await page.goto("/");
    await expect(page.getByTestId("dao-row")).toHaveCount(4);

    await page.getByLabel("Search DAOs by name").fill("council");
    await expect(page.getByTestId("dao-row")).toHaveCount(1);
    await expect(page.getByTestId("dao-row")).toContainText("Treasury council");
});

test("a Scan without BFE-423 (no total): Prev and Next by cursor, and ?page is ignored", async ({page, network}) => {
    // such a Scan ignores `page` and answers the first cursor page, with no total
    const [a, b, c] = fourScanDaos();
    network.use("scan", {path: SCAN_DAOS, query: {page: "3", limit: "20"}, status: 200, body: {items: [a, b, c], next_cursor: "c1", supported: true}});
    // once it is known to answer no totals, the first page is asked for without a page
    network.use("scan", {path: SCAN_DAOS, query: {limit: "20"}, status: 200, body: {items: [a, b, c], next_cursor: "c1", supported: true}});
    await page.goto("/?page=3");

    const rows = page.getByTestId("dao-row");
    const pager = page.getByRole("navigation", {name: "Pages"});
    await expect(rows).toHaveCount(3);
    await expect(page.getByTestId("list-count")).toHaveText("Page 1");
    await expect(pager.getByRole("button", {name: "Previous page"})).toBeDisabled();

    await pager.getByRole("button", {name: "Next page"}).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Beekeepers");
    await expect(page.getByTestId("list-count")).toHaveText("Page 2");
    await expect(pager.getByRole("button", {name: "Next page"})).toBeDisabled();

    await pager.getByRole("button", {name: "Previous page"}).click();
    await expect(rows).toHaveCount(3);
    await expect(page.getByTestId("list-count")).toHaveText("Page 1");
});
