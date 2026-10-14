import {expect, test} from "./support/mock-network";

// "Create my token" (/token/new, BFE-147) without a wallet, against the testnet fixtures.
// The fee comes from fixtures/lcd/tokenfactory.params.json (create_denom_fee: 25,000 TBZE).

test("shows the three questions, a live preview and the creation fee", async ({page}) => {
    await page.goto("/token/new");

    await expect(page.getByRole("heading", {name: "Create my token"})).toBeVisible();
    await expect(page.getByText("tokenfactory · create denom")).toBeVisible();

    const q1 = page.getByRole("region", {name: "Name and ticker"});
    await expect(q1).toHaveAttribute("data-state", "active");
    await expect(page.getByRole("region", {name: "Describe it"})).toHaveAttribute("data-state", "todo");
    await expect(page.getByRole("region", {name: "How many tokens to create?"})).toHaveAttribute("data-state", "todo");

    await q1.getByPlaceholder("e.g. Honey Coin", {exact: true}).fill("Honey Coin");
    await q1.getByPlaceholder("e.g. HONEY", {exact: true}).fill("honey");
    await expect(q1.getByText("Token ID: factory/<your address>/uhoney")).toBeVisible();

    const preview = page.getByRole("region", {name: "Preview"});
    await expect(preview.getByText("Honey Coin")).toBeVisible();
    await expect(preview.getByText("HONEY · Mintable")).toBeVisible();

    const pay = page.getByRole("region", {name: "You will pay"});
    await expect(pay.getByText("Token creation fee")).toBeVisible();
    await expect(pay.getByText("25,000 TBZE", {exact: true})).toBeVisible();

    await expect(page.getByRole("button", {name: "Create HONEY"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet to create this token.")).toBeVisible();
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/token/new");

    await expect(page.getByRole("region", {name: "You will pay"})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
