import {readFileSync} from "node:fs";
import {join} from "node:path";

import {expect, type Fixture, test} from "./support/mock-network";

// The token site shell (BFE-125), against the testnet fixtures. NOAD (NoAdminToken) has a brand
// kit (JetBrains Mono, light primary #be1981, dark primary #e67fc0), a holders pool with 20 NOAD
// staked, 1,001,000 NOAD of supply and one pool with TUSDC that prices it at $0.10. The trimmed
// aggregator tickers carry no testnet pool, so its 24h volume is $0, and the burn history is empty.

const NOAD = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
// Vidulum (VDL) sits in no pool, so it can't be swapped into.
const VIDULUM = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/vidulum";
const tokenPage = (denom: string) => `/token?denom=${encodeURIComponent(denom)}`;
const recorded = (file: string): Fixture =>
    JSON.parse(readFileSync(join(__dirname, "fixtures", "lcd", file), "utf8")) as Fixture;

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

test("Get on a tradable token opens the drawer's Get tab on a connect prompt", async ({page}) => {
    await page.goto(tokenPage(NOAD));

    await page.getByRole("button", {name: "Get NOAD"}).first().click();

    const drawer = page.getByRole("dialog", {name: "Your NoAdminToken wallet"});
    await expect(drawer.getByTestId("wallet-connect-prompt")).toBeVisible();
    await expect(drawer.getByText("Not tradable yet")).toHaveCount(0);
});

test("Get on a token in no pool says it is not tradable yet", async ({page}) => {
    await page.goto(tokenPage(VIDULUM));
    await expect(page.getByRole("heading", {level: 1, name: "Vidulum"})).toBeVisible();

    await page.getByRole("button", {name: "Get VDL"}).first().click();

    const drawer = page.getByRole("dialog", {name: "Your Vidulum wallet"});
    await expect(drawer.getByTestId("get-not-tradable")).toHaveText(/Not tradable yet/);
    await expect(drawer.getByTestId("wallet-connect-prompt")).toBeVisible();
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

    // The holders pool's "Add rewards to the pool" is the one deliberate link out (R5).
    const addRewards = `https://testnet-factory.getbze.com/denom-reward/schedule?denom=${encodeURIComponent(NOAD)}`;
    const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    expect(hrefs.filter((href) => /\.getbze\.com/.test(href))).toEqual([addRewards]);

    await expect(page.getByAltText("BZE application logo")).toHaveCount(0);
    await expect(page.getByRole("button", {name: /directory/i})).toHaveCount(0);
    // NOAD has no BZE pool, so it can't pay fees itself: the footer names the network (R12).
    await expect(page.getByRole("link", {name: "Runs on BeeZee"})).toHaveAttribute("href", "https://getbze.com");
});

test("the holders pool lists what it pays, the unpriced reward last and no APR", async ({page}) => {
    await page.goto(tokenPage(NOAD));

    // NOAD's pool pays 10 NOAD and 10 VDL a day; VDL sits in no pool, so it has no price.
    const pool = page.getByTestId("holders-pool");
    const rows = pool.getByTestId("holders-pool-prizes").getByRole("row");
    await expect(rows).toHaveText(["RewardPaid dailyFunded for", "NOAD10363 days", "VDL10198 days"]);
    await expect(pool.getByTestId("holders-pool-apr")).toHaveCount(0);
    await expect(pool).toContainText("Total staked20 NOAD");
    await expect(pool).toContainText("Unlock time7 days");
    await expect(pool.getByRole("button", {name: "Connect wallet"})).toBeVisible();
});

test("the holders pool shows its APR when every reward has a price", async ({page, network}) => {
    // Only the NOAD schedule: 10 NOAD a day over 20 NOAD staked is 18,250% whatever NOAD's price.
    const schedules = recorded("rewards.denom_reward_schedules.noadmin.json");
    const body = schedules.body as { list: { prize_denom: string }[] };
    network.use("lcd", {...schedules, body: {...body, list: body.list.filter((schedule) => schedule.prize_denom === NOAD)}});

    await page.goto(tokenPage(NOAD));

    await expect(page.getByTestId("holders-pool-apr")).toHaveText("18,250.0%Est. APR");
});

test("a token without a holders pool says so and links to the Factory to start one", async ({page}) => {
    await page.goto(tokenPage(VIDULUM));

    await expect(page.getByTestId("holders-pool-empty")).toContainText("No holders pool yet");
    await expect(page.getByRole("link", {name: "Start a holders pool"}))
        .toHaveAttribute("href", `https://testnet-factory.getbze.com/manage/token?denom=${encodeURIComponent(VIDULUM)}`);
});
