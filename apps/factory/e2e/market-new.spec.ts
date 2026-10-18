import {expect, test} from "./support/mock-network";

// "Allow limit orders" (/market/new, BFE-144) without a wallet, against the testnet fixtures.
// The fee comes from fixtures/lcd/tradebin.params.json (createMarketFee: 25,000 TBZE).

test("shows the questions, the outcome and the market fee", async ({page}) => {
    await page.goto("/market/new");

    await expect(page.getByRole("heading", {name: "Allow limit orders"})).toBeVisible();
    await expect(page.getByText("tradebin · order-book market")).toBeVisible();

    const q1 = page.getByRole("region", {name: "What is being traded?"});
    const q2 = page.getByRole("region", {name: "What is it priced in?"});
    await expect(q1).toBeVisible();
    await expect(q1).toHaveAttribute("data-state", "active");
    await expect(q2).toHaveAttribute("data-state", "todo");

    await expect(page.getByRole("region", {name: "What will happen"})).toContainText("order book");

    const pay = page.getByRole("region", {name: "You will pay"});
    await expect(pay.getByText("Market creation fee")).toBeVisible();
    await expect(pay.getByText("25,000 TBZE", {exact: true})).toBeVisible();
    await expect(pay.getByText("Connect your wallet to check your balance.")).toBeVisible();

    await expect(page.getByRole("button", {name: "Create market"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet to create this market.")).toBeVisible();
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/market/new");

    await expect(page.getByRole("region", {name: "You will pay"})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
