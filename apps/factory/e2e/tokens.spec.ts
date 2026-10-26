import {readFileSync} from "node:fs";
import {join} from "node:path";
import {expect, test} from "./support/mock-network";

// The Tokens directory (/tokens, BFE-267) without a wallet, against the testnet fixtures: four factory
// tokens (fixtures/lcd/bank.supply.json), only noadmin stakable (20 NOAD staked). The paging cases add
// 25 more factory tokens to the supply through network.use.

const ISSUER = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";
const SUPPLY = JSON.parse(readFileSync(join(__dirname, "fixtures", "lcd", "bank.supply.json"), "utf8"));

/** The recorded supply plus `n` factory tokens without metadata, so their tickers read `factory/…` and sort before TUSDC. */
const supplyWithMore = (n: number) => ({
    ...SUPPLY,
    body: {
        ...SUPPLY.body,
        supply: [
            ...SUPPLY.body.supply,
            ...Array.from({length: n}, (_, i) => ({denom: `${ISSUER}/e2e${String(i).padStart(2, "0")}`, amount: "1000"})),
        ],
    },
});

const rowNames = (page: import("@playwright/test").Page) =>
    // Desktop hides the rows of earlier pages that phones keep, so count the visible ones.
    page.getByRole("region", {name: "All tokens"}).locator('[data-testid="token-row"]:visible').getByRole("link");

test("lists every Factory token, most staked first, then A–Z, with no 'Created by you' group", async ({page}) => {
    await page.goto("/tokens");

    await expect(page.getByRole("heading", {level: 1, name: "Tokens"})).toBeVisible();
    const all = page.getByRole("region", {name: "All tokens"});
    await expect(all.getByRole("heading", {name: "All tokens · 4"})).toBeVisible();
    await expect(all.getByTestId("token-row").getByRole("link")).toHaveText([
        "NoAdminToken · NOAD",
        "USDollar · TUSDC",
        "Vidulum · VDL",
        "XFactor · XFCT",
    ]);
    await expect(all.getByTestId("token-row").first()).toContainText("Stakable · 20 staked");
    await expect(all.getByTestId("token-row").nth(1)).toContainText("Not stakable yet");
    await expect(page.getByRole("region", {name: "Created by you"})).toHaveCount(0);

    // No LP shares, IBC or native tokens.
    await expect(all).not.toContainText("TBZE");
    await expect(all).not.toContainText("ULMN");
});

test("a row opens the token page", async ({page}) => {
    await page.goto("/tokens");

    await expect(page.getByRole("link", {name: "Vidulum · VDL"})).toHaveAttribute(
        "href",
        `/tokens/token?denom=${encodeURIComponent(`${ISSUER}/vidulum`)}`,
    );
});

test("searches by name, ticker or denom and keeps the search in the URL", async ({page}) => {
    await page.goto("/tokens");

    const search = page.getByRole("textbox", {name: "Search tokens"});
    await search.fill("vidul");
    await expect(page.getByRole("region", {name: "All tokens"}).getByTestId("token-row")).toHaveCount(1);
    await expect(page).toHaveURL(/\/tokens\?filter=all&q=vidul$/);

    await page.reload();
    await expect(page.getByRole("textbox", {name: "Search tokens"})).toHaveValue("vidul");
    await expect(page.getByRole("link", {name: "Vidulum · VDL"})).toBeVisible();

    await page.getByRole("textbox", {name: "Search tokens"}).fill("nothing here");
    await expect(page.getByText("No token matches 'nothing here'.")).toBeVisible();
});

test("the Stakable filter keeps the tokens with a compounded reward", async ({page}) => {
    await page.goto("/tokens");

    await page.getByRole("group", {name: "Filter"}).getByRole("button", {name: "Stakable"}).click();
    await expect(page).toHaveURL(/\/tokens\?filter=stakable$/);
    await expect(page.getByRole("region", {name: "All tokens"}).getByTestId("token-row").getByRole("link")).toHaveText(["NoAdminToken · NOAD"]);

    await page.getByRole("group", {name: "Filter"}).getByRole("button", {name: "Created by you"}).click();
    await expect(page.getByText("Connect your wallet to see the tokens you created.")).toBeVisible();
});

test("pages of 20 with numbered pages, the page kept in the URL", async ({page, network}) => {
    network.use("lcd", supplyWithMore(25));
    await page.goto("/tokens");

    const all = page.getByRole("region", {name: "All tokens"});
    await expect(all.getByRole("heading", {name: "All tokens · 29"})).toBeVisible();
    await expect(rowNames(page)).toHaveCount(20);
    await expect(rowNames(page).first()).toHaveText("NoAdminToken · NOAD");
    await expect(all.getByRole("button", {name: /Show \d+ more/})).toBeHidden();

    await page.getByRole("navigation", {name: "Pages"}).getByRole("button", {name: "Page 2"}).click();
    await expect(page).toHaveURL(/\/tokens\?filter=all&page=2$/);
    await expect(rowNames(page)).toHaveCount(9);
    await expect(rowNames(page).last()).toHaveText("XFactor · XFCT");

    await page.reload();
    await expect(page.getByRole("button", {name: "Page 2"})).toHaveAttribute("aria-current", "page");
    await expect(rowNames(page)).toHaveCount(9);
});

test.describe("at 390 px", () => {
    test.use({viewport: {width: 390, height: 844}});

    test("phones grow the list with 'Show 9 more' and never scroll sideways", async ({page, network}) => {
        network.use("lcd", supplyWithMore(25));
        await page.goto("/tokens");

        await expect(rowNames(page)).toHaveCount(20);
        await expect(page.getByRole("navigation", {name: "Pages"})).toBeHidden();
        await page.getByRole("button", {name: "Show 9 more"}).click();
        await expect(page).toHaveURL(/\/tokens\?filter=all&page=2$/);
        await expect(rowNames(page)).toHaveCount(29);
        await expect(page.getByRole("button", {name: /Show \d+ more/})).toHaveCount(0);

        const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        await expect.poll(overflow, {message: "horizontal page scroll", timeout: 5000}).toBeLessThanOrEqual(0);
    });
});
