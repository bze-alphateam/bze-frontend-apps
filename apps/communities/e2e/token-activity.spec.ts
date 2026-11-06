import {expect, test} from "./support/mock-network";

// "Activity · T right now" on the token page, against the BZE Scan fixtures in fixtures/scan/
// (testnet explorer, 2026-11-06). NOAD's five newest transactions are the canvas rows: a burner
// fund, a reward program, two sells and a buy, each with the BZE fee it paid.

const NOAD = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
const ENCODED = encodeURIComponent(NOAD);
const tokenPage = (denom: string) => `/token?denom=${encodeURIComponent(denom)}`;

test("the token page shows its five newest transactions with their fees", async ({page}) => {
    await page.goto(tokenPage(NOAD));

    const section = page.locator("section#activity");
    await expect(section.getByRole("heading", {level: 2, name: "NOAD right now"})).toBeVisible();
    await expect(section.getByText("8 holders · 9 transfers in the last 24 hours")).toBeVisible();

    const rows = section.getByRole("list", {name: "Latest NOAD activity"}).getByRole("listitem");
    await expect(rows).toHaveCount(5);

    const expected = [
        ["Burn", "Sent to the burner", "14 NOAD", "Fee 0.00093 BZE", "8E56…F595"],
        ["Rewards", "Started a reward program", "1,000 NOAD", "Fee 0.002195 BZE", "7FC2…E7C1"],
        ["Swap", "Sold NOAD", "10 NOAD", "Fee 0.003823 BZE", "EDA3…B3C0"],
        ["Swap", "Sold NOAD", "10 NOAD", "Fee 0.003021 BZE", "1EC7…ED52"],
        ["Swap", "Bought NOAD", "143.85655 NOAD", "Fee 0.002971 BZE", "D20E…0AAE"],
    ];
    for (const [i, [tag, title, amount, fee, tx]] of expected.entries()) {
        const row = rows.nth(i);
        await expect(row.getByText(tag, {exact: true})).toBeVisible();
        await expect(row.getByText(title, {exact: true})).toBeVisible();
        await expect(row.getByText(amount, {exact: true})).toBeVisible();
        await expect(row.getByText(fee, {exact: true})).toBeVisible();
        await expect(row.getByRole("link", {name: tx})).toHaveAttribute("href", new RegExp(`^/token/tx\\?denom=${ENCODED}&hash=${tx.slice(0, 4)}`));
    }
    await expect(rows.first().getByRole("link", {name: "bze1fk…y3y5k"}))
        .toHaveAttribute("href", `/token/holder?denom=${ENCODED}&address=bze1fkj4ngtlqcxs83q360fl6f8jn8phzh4y6y3y5k`);

    await expect(section.getByRole("link", {name: "See all activity"})).toHaveAttribute("href", `/token/activity?denom=${ENCODED}`);
});

test("the header's Activity link scrolls to the snippet, between Burn and Token", async ({page}) => {
    await page.goto(tokenPage(NOAD));

    const nav = page.locator("header").getByRole("navigation", {name: "Sections"});
    await expect(nav.getByRole("link", {name: "Activity"})).toHaveAttribute("href", "#activity");
    const labels = await nav.getByRole("link").allTextContents();
    expect(labels.slice(-3)).toEqual(["Burn", "Activity", "Token"]);

    // Activity sits right before Token details on the page too.
    const order = await page.locator("main > section").evaluateAll((sections) => sections.map((s) => s.id));
    expect(order.indexOf("activity")).toBe(order.indexOf("details") - 1);
});

test("a token with nothing indexed says so", async ({page, network}) => {
    network.use("scan", {path: "/api/scan/token/transfers", query: {denom: NOAD, limit: "100"}, status: 200, body: {items: [], next_cursor: null}});
    await page.goto(tokenPage(NOAD));

    const section = page.locator("section#activity");
    await expect(section.getByRole("heading", {name: "No activity indexed yet"})).toBeVisible();
    await expect(section.getByText("Trades, stakes, burns and transfers of NOAD show up here as soon as they happen.")).toBeVisible();
});

test("Scan not answering shows a retry that loads the rows", async ({page}) => {
    let failing = true;
    await page.route("**/api/scan/token/transfers?**", async (route) => {
        if (!failing) return route.fallback();
        await route.fulfill({status: 502, contentType: "application/json", body: JSON.stringify({error: {code: "upstream_error", message: "BZE Scan unavailable"}})});
    });
    await page.goto(tokenPage(NOAD));

    const alert = page.locator("section#activity").getByRole("alert");
    // The hook retries a 502 twice before it gives up.
    await expect(alert).toHaveText(/Couldn't load NOAD activity\. BZE Scan didn't answer\./, {timeout: 15_000});

    failing = false;
    await alert.getByRole("button", {name: "Retry"}).click();
    await expect(page.getByRole("list", {name: "Latest NOAD activity"}).getByRole("listitem")).toHaveCount(5);
});
