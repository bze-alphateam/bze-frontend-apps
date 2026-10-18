import {expect, test} from "./support/mock-network";

// Smoke spec for the goal-first home (BFE-167), its search (BFE-168) and /manage (BFE-165) without a wallet, against
// the testnet fixtures in e2e/fixtures/.

test("the home starts from goals, with their live fees and the All tools row", async ({page}) => {
    await page.goto("/");

    await expect(page.getByRole("heading", {name: "What do you want to do?"})).toBeVisible();
    for (const group of ["1 · Start", "2 · Get it traded", "3 · Grow the community", "4 · Make it official"]) {
        await expect(page.getByRole("heading", {name: group})).toBeVisible();
    }

    // The fees come from fixtures/lcd/tokenfactory.params.json, tradebin.params.json and
    // rewards.params.json (25,000 TBZE each, testnet's native ticker).
    await expect(page.getByTestId("goal-createToken")).toContainText("Token factory · 25,000 TBZE");
    await expect(page.getByTestId("goal-pool")).toContainText("Liquidity pool · 25,000 TBZE");
    await expect(page.getByTestId("goal-stakable")).toContainText("Holder rewards · 25,000 TBZE");
    await expect(page.getByTestId("goal-multisend")).not.toContainText("TBZE");

    const tools = page.getByRole("region", {name: "All tools"});
    await expect(tools.getByRole("button", {name: "Create token"})).toBeVisible();
    await expect(tools.getByRole("button", {name: "My creations"})).toBeVisible();
    // No wallet: no Your tokens strip.
    await expect(page.getByRole("region", {name: "Your tokens"})).toHaveCount(0);
});

test("the search finds goals in everyday words: / focuses it, Enter opens the active row", async ({page}) => {
    await page.goto("/");
    await expect(page.getByTestId("goal-createToken")).toBeVisible();

    await page.keyboard.press("/");
    const box = page.getByRole("combobox", {name: "What do you want to do?"});
    await expect(box).toBeFocused();
    await page.keyboard.type("airdrop");

    const options = page.getByRole("listbox", {name: "Search results"}).getByRole("option");
    await expect(options.nth(0)).toContainText("Gift my stakers, once");
    await expect(options.nth(1)).toContainText("Reach another community");
    await expect(options.nth(2)).toContainText("Send to a list of wallets");

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/multisend$/);
});

test("the search panel is full width on a 390 px phone", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/");
    await page.getByRole("combobox", {name: "What do you want to do?"}).fill("logo");
    const panel = page.getByTestId("goal-search-panel");
    await expect(panel).toContainText("Get my logo in every wallet");

    const box = await panel.boundingBox();
    expect(box?.width).toBeGreaterThan(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});

test("the home fits a 390 px phone", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/");
    await expect(page.getByTestId("goal-createToken")).toContainText("25,000 TBZE");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});

test("/manage without a wallet shows the empty state", async ({page}) => {
    await page.goto("/manage");

    await expect(page.getByRole("heading", {name: "Your tokens"})).toBeVisible();
    await expect(page.getByText("No tokens yet.")).toBeVisible();
    await expect(page.getByRole("button", {name: "Create your first token"})).toBeVisible();
    await expect(page.getByText("You haven't created a market or pool yet.")).toBeVisible();
});

test("/manage fits a 390 px phone", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/manage");
    await expect(page.getByRole("button", {name: "Create your first token"})).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});

test("the navbar's Apps menu lists the other BZE apps with their icons, Explorer on the testnet explorer", async ({page}) => {
    await page.goto("/");
    await page.getByRole("button", {name: "Apps"}).click();

    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem")).toHaveText(["Website", "DEX", "Staking", "Burner", "Communities", "Explorer"]);
    await expect(menu.getByTestId("app-icon")).toHaveCount(6);
    const explorer = menu.getByRole("menuitem", {name: "Explorer"});
    await expect(explorer).toHaveAttribute("href", "https://testnet-explorer.getbze.com");
    await expect(explorer).toHaveAttribute("target", "_blank");
});
