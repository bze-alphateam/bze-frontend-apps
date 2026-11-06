import {expect, test} from "./support/mock-network";

// The token site's Activity, holder and transaction pages, against the BZE Scan fixtures in
// fixtures/scan/ and the LCD fixtures (testnet, 2026-11-06). NOAD has 8 holders, a supply of
// 1,000,880 NOAD, 20 NOAD in its holders pool and no fixed-term program staking it; the creator
// holds 965,105.382489 NOAD and stakes those 20 NOAD.

const NOAD = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
const ENCODED = encodeURIComponent(NOAD);
const CREATOR = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";
const SWAP = "EDA31BBD24F96E51707CCC623670317FDE5AE23DC5F9EEB46E8B224AB159B3C0";

const activityPage = `/token/activity?denom=${ENCODED}`;
const holderPage = (address: string) => `/token/holder?denom=${ENCODED}&address=${address}`;
const txPage = (hash: string) => `/token/tx?denom=${ENCODED}&hash=${hash}`;

test("the Activity page shows the token's numbers and one row per transaction", async ({page}) => {
    await page.goto(activityPage);

    await expect(page.getByRole("heading", {level: 1, name: "What's happening with NOAD"})).toBeVisible();
    await expect(page.getByTestId("activity-stat-holders")).toContainText("8");
    await expect(page.getByTestId("activity-stat-transfers")).toContainText("9");
    await expect(page.getByTestId("activity-stat-moved")).toContainText("1,198.87255 NOAD");
    await expect(page.getByTestId("activity-stat-supply")).toContainText("1,000,880 NOAD");

    const rows = page.getByRole("list", {name: "NOAD activity"}).getByRole("listitem");
    await expect(rows).toHaveCount(6);
    await expect(rows.nth(2)).toContainText("Sold NOAD");
    await expect(rows.nth(2)).toContainText("Fee 0.003823 BZE");
    await expect(rows.nth(2).getByRole("link", {name: "EDA3…B3C0"})).toHaveAttribute("href", txPage(SWAP));
    // Every row of the transfers page is shown, so nothing is left to load.
    await expect(page.getByRole("button", {name: "Load more"})).toHaveCount(0);

    // The header leads back to the token page, with Activity as the current page.
    const nav = page.locator("header").getByRole("navigation", {name: "Sections"});
    await expect(nav.getByRole("link", {name: "Activity"})).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", {name: "Stake"})).toHaveAttribute("href", `/token?denom=${ENCODED}#stake`);
    await expect(page.getByRole("link", {name: "NoAdminToken"}).first()).toHaveAttribute("href", `/token?denom=${ENCODED}`);
});

test("the Holders tab splits the supply and ranks the holders", async ({page}) => {
    await page.goto(activityPage);
    await page.getByRole("tab", {name: /Holders/}).click();

    const split = page.getByTestId("supply-split");
    await expect(split.getByTestId("supply-part-staked")).toContainText("20 NOAD");
    await expect(split.getByTestId("supply-part-budgets")).toContainText("7,036 NOAD");
    await expect(split.getByTestId("supply-part-dex")).toContainText("964.433611 NOAD");
    await expect(split.getByTestId("supply-part-top10")).toContainText("99.20 %");
    await expect(split.getByTestId("supply-part-rest")).toContainText("14.01 NOAD");

    const holders = page.getByTestId("holder-row");
    await expect(holders).toHaveCount(7);
    await expect(holders.first()).toContainText("Creator");
    await expect(holders.first()).toContainText("965,105.382489");
    await expect(holders.nth(3)).toContainText("Rewards");
    await expect(holders.first().getByRole("link", {name: "bze1z3…qwg3l"})).toHaveAttribute("href", holderPage(CREATOR));
});

test("the History tab lists the token's events", async ({page}) => {
    await page.goto(activityPage);
    await page.getByRole("tab", {name: "History"}).click();

    const history = page.getByTestId("history-timeline");
    await expect(history.getByText("Brand kit updated")).toHaveCount(8);
    // TMS isn't among the e2e assets, so the pool's other side shows as its short denom.
    await expect(history.getByText(/ \/ NOAD pool created$/)).toBeVisible();
    await expect(history.getByText("1,000 NOAD minted")).toBeVisible();
    await expect(history.getByText("Earlier history isn't indexed yet.")).toBeVisible();
});

test("the Activity tab says so when Scan doesn't answer", async ({page, network}) => {
    network.use("scan", {path: "/api/scan/token/transfers", query: {denom: NOAD, limit: "100"}, status: 502, body: {error: {code: "upstream_error", message: "BZE Scan unavailable"}}});
    await page.goto(activityPage);

    // The hook retries a 502 twice before it gives up.
    const alert = page.getByRole("alert").filter({hasText: "Couldn't load NOAD activity"});
    await expect(alert).toBeVisible({timeout: 15_000});
    await expect(alert.getByRole("button", {name: "Retry"})).toBeVisible();
});

test("the holder page shows the balance, the stake and the holder's own NOAD moves", async ({page}) => {
    await page.goto(holderPage(CREATOR));

    await expect(page.getByRole("heading", {level: 1, name: "bze1z3…qwg3l"})).toBeVisible();
    await expect(page.getByText("NOAD holder · #1 of 8")).toBeVisible();
    await expect(page.getByText(CREATOR, {exact: true})).toBeVisible();

    await expect(page.getByTestId("holder-balance")).toContainText("965,105.382489 NOAD");
    await expect(page.getByTestId("holder-balance")).toContainText("96.43 % of the supply");
    const staked = page.getByTestId("holder-staked");
    await expect(staked).toContainText("20 NOAD");
    await expect(staked.getByTestId("holder-position")).toContainText("Holders pool");

    const rows = page.getByRole("list", {name: "NOAD activity of this holder"}).getByRole("listitem");
    await expect(rows).toHaveCount(5);
    await expect(rows.first()).toContainText("Started a reward program");
    await expect(rows.first()).toContainText("−1,000 NOAD");
    await expect(rows.nth(4)).toContainText("+56 NOAD");
    // Every row is this holder's, so no "by" line.
    await expect(rows.first().getByText("by", {exact: true})).toHaveCount(0);
});

test("the transaction page sums a swap up in plain words", async ({page}) => {
    await page.goto(txPage(SWAP));

    await expect(page.getByRole("heading", {level: 1, name: "Swapped 10 NOAD for 6.866381 CTR"})).toBeVisible();
    const summary = page.getByTestId("tx-summary");
    await expect(summary).toContainText("plus a 0.1 BZE trading fee");
    await expect(summary).toContainText("≈ 0.686638 CTR per NOAD");

    const details = page.getByTestId("tx-details");
    await expect(details).toContainText("NOAD → TMS → BZE → CTR · 3 pools");
    await expect(details).toContainText("0.01 NOAD · 0.0957 TMS · 0.023748 BZE");
    await expect(details).toContainText("0.003823 BZE");
    await expect(details).toContainText("communities.getbze.com");
    await expect(details).toContainText("4,099,213");
    await expect(details).toContainText(SWAP);
    await expect(page.getByRole("link", {name: "More from this holder"}))
        .toHaveAttribute("href", holderPage("bze1fkj4ngtlqcxs83q360fl6f8jn8phzh4y6y3y5k"));
});

test("a transaction Scan hasn't indexed yet says so", async ({page, network}) => {
    const pending = "AB".repeat(32);
    network.use("scan", {path: `/api/scan/txs/${pending}`, status: 404, body: {error: {code: "not_found", message: "transaction not found"}}});
    await page.goto(txPage(pending));

    await expect(page.getByTestId("tx-not-indexed")).toContainText("Not indexed yet");
    await expect(page.getByText(pending)).toBeVisible();
});
