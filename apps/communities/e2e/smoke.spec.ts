import {expect, test} from "./support/mock-network";

// Smoke spec for the directory and the token page, against the testnet fixtures in e2e/fixtures/.
// The four factory tokens below come from fixtures/lcd/bank.supply.json and their names from
// fixtures/lcd/bank.denoms_metadata.json.

const CREATOR = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";

const TOKENS = [
    {denom: `${CREATOR}/noadmin`, name: "NoAdminToken"},
    {denom: `${CREATOR}/testusd`, name: "USDollar"},
    {denom: `${CREATOR}/uxfct`, name: "XFactor"},
    {denom: `${CREATOR}/vidulum`, name: "Vidulum"},
];

const tokenPage = (denom: string) => `/token?denom=${encodeURIComponent(denom)}`;

test("the directory lists every factory token", async ({page}) => {
    await page.goto("/");

    for (const token of TOKENS) {
        const card = page.getByRole("link", {name: new RegExp(token.name)});
        await expect(card).toBeVisible();
        await expect(card).toHaveAttribute("href", tokenPage(token.denom));
    }
});

test("a token page opened by URL shows the token", async ({page}) => {
    // noadmin carries a brand kit and a holders pool on testnet, so this also loads both.
    const token = TOKENS[0];
    await page.goto(tokenPage(token.denom));

    await expect(page.getByText(token.name, {exact: true}).first()).toBeVisible();
    await expect(page.getByText(token.denom, {exact: true})).toBeVisible();
    await expect(page.getByText("Token not found")).toHaveCount(0);
});

test("an unknown denom shows the not-found state", async ({page}) => {
    await page.goto(tokenPage(`${CREATOR}/doesnotexist`));

    await expect(page.getByText("Token not found")).toBeVisible();
    await expect(page.getByRole("button", {name: "Browse all tokens"})).toBeVisible();
});

test("the navbar's Apps menu lists the other BZE apps with their icons, Explorer included", async ({page}) => {
    await page.goto("/");
    // The shared header carries the Communities lockup; the token page test checks it is absent there by this alt text.
    await expect(page.getByTestId("app-header").getByAltText("BeeZee Communities").filter({visible: true})).toHaveCount(1);
    await page.getByRole("button", {name: "Apps"}).click();

    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem")).toHaveText(["Website", "DEX", "Staking", "Burner", "Factory", "Explorer"]);
    await expect(menu.getByTestId("app-icon")).toHaveCount(6);
    await expect(menu.getByRole("menuitem", {name: "Explorer"})).toHaveAttribute("href", "https://testnet-explorer.getbze.com");
});
