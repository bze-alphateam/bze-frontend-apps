import {expect, test} from "./support/mock-network";

// Create an order-book market (/market/new, BFE-263) without a wallet, against the testnet fixtures.
// The fee comes from fixtures/lcd/tradebin.params.json (createMarketFee: 25,000 TBZE); VDL comes from
// fixtures/lcd/bank.denoms_metadata.json, and the one existing market from
// fixtures/lcd/tradebin.all_markets.json (stored as <ibc USDC>/<TUSDC>).

const ISSUER = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";
const VDL = encodeURIComponent(`${ISSUER}/vidulum`);
const TUSDC_DENOM = `${ISSUER}/testusd`;
const IBC_DENOM = "ibc/9DA252F9F9C86132CC282EA431DFB7DE7729501F6DC9A3E0F50EC8C6EE380CC7";

test("opens on Pair, then a deep-linked pair reaches Review with the market fee", async ({page}) => {
    await page.goto("/market/new");

    await expect(page.getByRole("heading", {name: "Create an order-book market"})).toBeVisible();
    await expect(page.getByText("tradebin · order-book market")).toBeVisible();
    const pair = page.getByRole("region", {name: "Pair"});
    await expect(pair).toHaveAttribute("data-state", "active");
    await expect(pair.getByText("Orders are priced in the quote token, e.g. HONEY priced in BZE.")).toBeVisible();
    await expect(page.getByRole("region", {name: "Review"})).toHaveAttribute("data-state", "todo");

    await page.goto(`/market/new?base=${VDL}&quote=ubze`);
    await expect(pair).toHaveAttribute("data-state", "done");
    await expect(pair).toContainText("VDL priced in TBZE");

    const review = page.getByRole("region", {name: "Review"});
    await expect(review).toHaveAttribute("data-state", "active");
    const leaves = review.getByRole("region", {name: "Leaves your wallet"});
    await expect(leaves.getByText("Market creation fee")).toBeVisible();
    await expect(leaves.getByText("25,000 TBZE", {exact: true})).toBeVisible();
    await expect(review.getByRole("region", {name: "You get"})).toContainText("An empty VDL/TBZE order book anyone can trade on");
    await expect(review.getByRole("region", {name: "Permanent"})).toContainText("One market per pair, and it can't be deleted");
    await expect(review.getByText("A new market is empty.", {exact: false})).toBeVisible();

    await expect(page.getByRole("region", {name: "What will happen"})).toContainText("A VDL/TBZE order book opens on the DEX.");
    const pay = page.getByRole("region", {name: "You will pay"});
    await expect(pay.getByText("Market creation fee")).toBeVisible();
    await expect(pay.getByText("25,000 TBZE", {exact: true})).toBeVisible();

    await expect(review.getByRole("button", {name: "Create market"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet.")).toBeVisible();
});

test("a pair whose market exists the other way round links to it on the DEX in its real direction", async ({page}) => {
    await page.goto(`/market/new?base=${encodeURIComponent(TUSDC_DENOM)}&quote=${encodeURIComponent(IBC_DENOM)}`);

    const pair = page.getByRole("region", {name: "Pair"});
    await expect(pair).toHaveAttribute("data-state", "active");
    await expect(pair.getByText("This pair already has a market. Each pair gets exactly one.")).toBeVisible();
    const link = pair.getByRole("link", {name: /Open it on the DEX/});
    await expect(link).toHaveAttribute("href", new RegExp(`/exchange/market\\?id=${encodeURIComponent(`${IBC_DENOM}/${TUSDC_DENOM}`)}$`));
    await expect(pair.getByRole("button", {name: "Continue"})).toBeDisabled();
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`/market/new?base=${VDL}&quote=ubze`);

    await expect(page.getByRole("region", {name: "You will pay"})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
