import {expect, test} from "./support/mock-network";

// The token site shell (BFE-125), against the testnet fixtures. NOAD (NoAdminToken) has a brand
// kit (JetBrains Mono, light primary #be1981, dark primary #e67fc0), a holders pool with 20 NOAD
// staked, 1,001,000 NOAD of supply and one pool with TUSDC that prices it at $0.10. The trimmed
// aggregator tickers carry no testnet pool, so its 24h volume is $0, and the burn history is empty.

const NOAD = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
const tokenPage = (denom: string) => `/token?denom=${encodeURIComponent(denom)}`;

test("the branded token renders its name, hero and key numbers", async ({page}) => {
    await page.goto(tokenPage(NOAD));

    await expect(page.getByRole("heading", {level: 1, name: "NoAdminToken"})).toBeVisible();
    await expect(page.getByText("no admin test token yes yes")).toBeVisible();
    await expect(page.getByTestId("token-site-price")).toHaveText("$0.1");

    await expect(page.getByTestId("key-number-cap")).toHaveText("Market cap$100.1K");
    await expect(page.getByTestId("key-number-supply")).toHaveText("Supply1.001M");
    await expect(page.getByTestId("key-number-staked")).toHaveText("Staked20");
    await expect(page.getByTestId("key-number-burned")).toHaveText("Burned0");
    await expect(page.getByTestId("key-number-volume")).toHaveText("24h volume$0");

    await expect(page.getByText(NOAD, {exact: true})).toBeVisible();
    await expect(page.getByTestId("supply-control")).toHaveText(/^Admin bze1z3/);
});

test("the kit's primary colour and font are applied", async ({page}) => {
    await page.goto(tokenPage(NOAD));

    const get = page.getByRole("button", {name: "Get NOAD"}).first();
    await expect(get).toHaveCSS("background-color", "rgb(190, 25, 129)");
    await expect(page.getByTestId("token-site")).toHaveCSS("font-family", /JetBrains Mono/);
});

test.describe("in dark mode", () => {
    test.use({colorScheme: "dark"});

    test("the kit's dark primary is applied", async ({page}) => {
        await page.goto(tokenPage(NOAD));

        await expect(page.getByRole("button", {name: "Get NOAD"}).first()).toHaveCSS("background-color", "rgb(230, 127, 192)");
    });
});

test("the header's wallet button opens the token's wallet drawer with a connect prompt", async ({page}) => {
    await page.goto(tokenPage(NOAD));

    // No wallet extension in e2e, so the drawer asks to connect one.
    await page.getByRole("button", {name: "Connect wallet"}).click();

    const drawer = page.getByRole("dialog", {name: "Your NoAdminToken wallet"});
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId("wallet-connect-prompt")).toBeVisible();
    // Portaled outside the page, still in the kit's colours.
    await expect(drawer.getByRole("button", {name: "Connect wallet"})).toHaveCSS("background-color", "rgb(190, 25, 129)");

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
});

test("the wallet drawer's settings switch the page to the kit's dark palette, no wallet needed", async ({page}) => {
    await page.goto(tokenPage(NOAD));
    const site = page.getByTestId("token-site");
    await expect(page.getByRole("heading", {level: 1, name: "NoAdminToken"})).toBeVisible();
    const lightBackground = await site.evaluate((element) => getComputedStyle(element).backgroundColor);

    await page.getByRole("button", {name: "Connect wallet"}).click();
    const drawer = page.getByRole("dialog", {name: "Your NoAdminToken wallet"});
    await drawer.getByRole("button", {name: "Settings"}).click();
    await expect(drawer.getByTestId("wallet-settings")).toBeVisible();

    const darkMode = drawer.getByRole("switch", {name: "Dark mode"});
    await darkMode.click();
    await expect(darkMode).toHaveAttribute("aria-checked", "true");
    await expect(site).not.toHaveCSS("background-color", lightBackground);
    // The kit's dark primary, as in the dark-mode test above.
    await expect(page.getByRole("button", {name: "Get NOAD"}).first()).toHaveCSS("background-color", "rgb(230, 127, 192)");

    await drawer.getByRole("button", {name: "Back to wallet"}).click();
    await expect(drawer.getByTestId("wallet-connect-prompt")).toBeVisible();
});

test("no element links to other BeeZee apps and no BeeZee chrome shows", async ({page}) => {
    await page.goto(tokenPage(NOAD));
    await expect(page.getByRole("heading", {level: 1, name: "NoAdminToken"})).toBeVisible();
    // Let the sections that load later (staking, burns, footer) settle.
    await page.waitForLoadState("networkidle");

    const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    expect(hrefs.filter((href) => /\.getbze\.com/.test(href))).toEqual([]);

    await expect(page.getByAltText("BZE application logo")).toHaveCount(0);
    await expect(page.getByRole("button", {name: /directory/i})).toHaveCount(0);
    // NOAD has no BZE pool, so it can't pay fees itself: the footer names the network (R12).
    await expect(page.getByRole("link", {name: "Runs on BeeZee"})).toHaveAttribute("href", "https://getbze.com");
});
