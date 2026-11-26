import {expect, test} from "./support/mock-network";

// The states of the home page when Scan or the node cannot serve the list.

const SCAN_DAOS = "/api/scan/daos";

test("a node on v8.2.x shows one friendly state instead of the lists", async ({page, network}) => {
    network.use("scan", {path: SCAN_DAOS, query: {limit: "20"}, status: 200, body: {items: [], next_cursor: null, supported: false}});
    await page.goto("/");

    await expect(page.getByText("DAOs arrive with the v8.3.0 network upgrade")).toBeVisible();
    await expect(page.getByTestId("dao-card")).toHaveCount(0);
    await expect(page.getByTestId("dao-explainer")).toHaveCount(0);
});

test("with Scan down the list falls back to the chain, with a notice and no open counts", async ({page, network}) => {
    network.use("scan", {path: SCAN_DAOS, query: {limit: "20"}, status: 502, body: {error: "BZE Scan unavailable"}});
    await page.goto("/");

    await expect(page.getByText("BZE Scan is not answering")).toBeVisible();
    const cards = page.getByTestId("dao-card");
    await expect(cards).toHaveCount(4);
    // the chain lists the newest first and knows nothing of open proposals
    await expect(cards.first()).toContainText("Stakers club");
    await expect(page.getByTestId("dao-open")).toHaveCount(0);
});

test("with Scan down and a v8.2.x node the list is the friendly state, not an error", async ({page, network}) => {
    network.use("scan", {path: SCAN_DAOS, query: {limit: "20"}, status: 502, body: {error: "BZE Scan unavailable"}});
    network.use("lcd", {path: "/bze/dao/params", status: 501, body: {code: 12, message: "unknown service bze.dao.Query", details: []}});
    await page.goto("/");

    await expect(page.getByText("DAOs arrive with the v8.3.0 network upgrade")).toBeVisible();
});

test("a Scan without the BFE-368 filters: the search runs on the page and the open feed is hidden", async ({page, network}) => {
    // Scan ignores the unknown `member` parameter and answers the whole list: that is how an older Scan reads
    network.use("scan", {path: SCAN_DAOS, query: {member: "not-an-address", limit: "1"}, status: 200, body: {items: [], next_cursor: null, supported: true}});
    // ... and does not know the cross-DAO proposals route
    await page.goto("/");
    await expect(page.getByTestId("dao-card")).toHaveCount(3);
    await expect(page.getByTestId("open-proposals")).toHaveCount(0);

    await page.getByLabel("Search DAOs by name").fill("council");
    await expect(page.getByTestId("dao-card")).toHaveCount(1);
    await expect(page.getByTestId("dao-card")).toContainText("Treasury council");
});
