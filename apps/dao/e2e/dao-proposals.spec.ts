import {expect, test} from "./support/mock-network";

// The Proposals tab of a DAO page. DAO 4 "Stakers club": 9 is in voting, 10 passed with failed actions
// (both Active), 11 was rejected and 5 cancelled (Finished; Scan also lists a placeholder row without a
// status, which is left out).
const SCAN_PROPOSALS = "/api/scan/daos/4/proposals";

test("Active lists the voting and the failed-execution proposals, newest first; Finished the rest", async ({page}) => {
    await page.goto("/dao/4");
    await page.getByRole("tab", {name: "Proposals"}).click();

    const rows = page.getByTestId("proposal-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Pay the beekeepers");
    await expect(rows.nth(0).getByTestId("row-status")).toHaveText("Execution failed");
    await expect(rows.nth(1)).toContainText("Fund the hive festival");
    await expect(rows.nth(1).getByTestId("row-status")).toHaveText("Voting");
    await expect(rows.nth(1).getByTestId("row-expedited")).toBeVisible();
    await expect(rows.nth(1).getByTestId("row-tally")).toHaveText("Turnout 80%, 93.75% yes");
    await expect(rows.nth(1)).toHaveAttribute("href", "/proposal/9");

    await page.getByRole("tab", {name: "Finished"}).click();
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Old honey budget");
    await expect(rows.nth(0).getByTestId("row-status")).toHaveText("Rejected");
    await expect(rows.nth(1).getByTestId("row-status")).toHaveText("Cancelled");
});

test("with Scan down Active falls back to the chain and Finished offers a retry", async ({page, network}) => {
    for (const status of ["voting", "execution_failed"]) {
        network.use("scan", {path: SCAN_PROPOSALS, query: {status, limit: "50"}, status: 502, body: {error: "BZE Scan unavailable"}});
    }
    network.use("scan", {path: SCAN_PROPOSALS, query: {limit: "20"}, status: 502, body: {error: "BZE Scan unavailable"}});

    await page.goto("/dao/4");
    await page.getByRole("tab", {name: "Proposals"}).click();

    await expect(page.getByText("read from the chain")).toBeVisible();
    await expect(page.getByTestId("proposal-row")).toHaveCount(2);
    await expect(page.getByTestId("proposal-row").first()).toContainText("Pay the beekeepers");

    await page.getByRole("tab", {name: "Finished"}).click();
    await expect(page.getByTestId("scan-retry")).toContainText("could not be loaded from BZE Scan");
    await expect(page.getByTestId("proposal-row")).toHaveCount(0);
});

test("a DAO with no finished proposals says so", async ({page, network}) => {
    network.use("scan", {path: SCAN_PROPOSALS, query: {limit: "20"}, status: 200, body: {items: [], next_cursor: null}});
    await page.goto("/dao/4");
    await page.getByRole("tab", {name: "Proposals"}).click();
    await page.getByRole("tab", {name: "Finished"}).click();

    await expect(page.getByTestId("finished-empty")).toBeVisible();
});
