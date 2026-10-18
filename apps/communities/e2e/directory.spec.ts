import {readFileSync} from "node:fs";
import {join} from "node:path";

import type {Page} from "@playwright/test";

import {expect, test, type Fixture} from "./support/mock-network";

// Directory search, filters, sort, pages and URL state (BFE-126), against the testnet fixtures.
// Testnet has four factory tokens; by ticker: NOAD (NoAdminToken), TUSDC (USDollar, the app's
// USDC), VDL (Vidulum), XFCT (XFactor). Only NOAD and TUSDC sit in a pool, NOAD has a brand kit
// and a holders pool, and the one reward program (on VDL) is finished. Market caps: TUSDC ≈ $987K
// (price 1), NOAD ≈ $100K (0.1 from its pool), the others unpriced.

const cards = (page: Page) => page.getByTestId("directory-card");
const search = (page: Page) => page.getByRole("searchbox", {name: "Search tokens"});

test("search narrows the list, writes q and survives a reload", async ({page}) => {
    await page.goto("/");
    await expect(cards(page)).toHaveCount(4);

    await search(page).fill("vidul");

    await expect(cards(page)).toHaveText([/Vidulum/]);
    await expect(page).toHaveURL(/\/\?q=vidul$/);

    await page.reload();
    await expect(search(page)).toHaveValue("vidul");
    await expect(cards(page)).toHaveText([/Vidulum/]);
});

test("Clear search on the empty state restores the full list", async ({page}) => {
    await page.goto("/?q=nomatch");
    await expect(page.getByText("No tokens match “nomatch”")).toBeVisible();

    await page.getByRole("button", {name: "Clear search"}).click();

    await expect(cards(page)).toHaveCount(4);
    await expect(search(page)).toHaveValue("");
    await expect(page).toHaveURL(/\/$/);
});

test("a filter + sort URL loads pre-applied", async ({page}) => {
    await page.goto("/?filter=tradable&sort=cap");

    await expect(page.getByRole("button", {name: "Tradable"})).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("combobox", {name: "Sort tokens"})).toHaveValue("cap");
    // By name NOAD would come first; by market cap TUSDC does.
    await expect(cards(page)).toHaveText([/USDollar/, /NoAdminToken/]);
    await expect(cards(page).first()).not.toContainText("Not traded yet");
});

test("the cards show the brand strip and reward badges", async ({page}) => {
    await page.goto("/?filter=rewards");

    await expect(cards(page)).toHaveText([/NoAdminToken/]);
    await expect(cards(page).first()).toContainText("Holders pool");
    // NOAD's kit primary in light mode is #be1981.
    await expect(page.getByTestId("directory-card-strip")).toHaveCSS("background-color", "rgb(190, 25, 129)");
});

test.describe("in dark mode", () => {
    test.use({colorScheme: "dark"});

    test("the brand strip uses the kit's dark primary, kit-less cards the neutral one", async ({page}) => {
        await page.goto("/");

        // NOAD's kit primary in dark mode is #e67fc0.
        const strips = page.getByTestId("directory-card-strip");
        await expect(strips.first()).toHaveCSS("background-color", "rgb(230, 127, 192)");
        await expect(strips.nth(1)).not.toHaveCSS("background-color", "rgb(230, 127, 192)");
    });
});

// 21 extra factory tokens (E2E01…E2E21) push testnet's four onto a second page of 20.
const extraTokens = Array.from({length: 21}, (_, i) => {
    const ticker = `E2E${String(i + 1).padStart(2, "0")}`;
    return {ticker, denom: `factory/bze1e2e/${ticker.toLowerCase()}`};
});

const recorded = (file: string): Fixture =>
    JSON.parse(readFileSync(join(__dirname, "fixtures", "lcd", file), "utf8")) as Fixture;

test("paging writes page to the URL", async ({page, network}) => {
    const supply = recorded("bank.supply.json");
    const body = supply.body as { supply: { denom: string; amount: string }[] };
    network.use("lcd", {
        ...supply,
        body: {...body, supply: [...body.supply, ...extraTokens.map(({denom}) => ({denom, amount: "1000000"}))]},
    });

    const metadata = recorded("bank.denoms_metadata.json");
    const metaBody = metadata.body as { metadatas: unknown[] };
    network.use("lcd", {
        ...metadata,
        body: {
            ...metaBody,
            metadatas: [...metaBody.metadatas, ...extraTokens.map(({ticker, denom}) => ({
                description: "", base: denom, display: ticker, name: `${ticker} Token`, symbol: ticker, uri: "", uri_hash: "",
                denom_units: [{denom, exponent: 0, aliases: []}, {denom: ticker, exponent: 6, aliases: []}],
            }))],
        },
    });

    await page.goto("/");
    await expect(cards(page)).toHaveCount(20);
    await expect(page.getByTestId("directory-count")).toHaveText("Showing 1–20 of 25 tokens");

    await page.getByRole("button", {name: "Page 2"}).click();

    await expect(page).toHaveURL(/\/\?page=2$/);
    await expect(page.getByTestId("directory-count")).toHaveText("Showing 21–25 of 25 tokens");
    await expect(cards(page)).toHaveText([/E2E21/, /NoAdminToken/, /USDollar/, /Vidulum/, /XFactor/]);
    await expect(page.getByRole("button", {name: "Next"})).toBeDisabled();

    await page.reload();
    await expect(page.getByTestId("directory-count")).toHaveText("Showing 21–25 of 25 tokens");
});
