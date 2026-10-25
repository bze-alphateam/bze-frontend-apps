import {expect, test} from "./support/mock-network";

// Create a liquidity pool (/pool/new, BFE-262) without a wallet, against the testnet fixtures.
// The fee comes from fixtures/lcd/tradebin.params.json (createMarketFee, charged for pools too:
// 25,000 TBZE); VDL comes from fixtures/lcd/bank.denoms_metadata.json, and the TUSDC/TBZE pool
// from fixtures/lcd/tradebin.all_liquidity_pools.json.

const ISSUER = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";
const VDL = encodeURIComponent(`${ISSUER}/vidulum`);
const TUSDC = encodeURIComponent(`${ISSUER}/testusd`);

test("walks Pair · Starting amounts · Fees up to Review with the pool fee", async ({page}) => {
    await page.goto(`/pool/new?base=${VDL}&quote=ubze`);

    await expect(page.getByRole("heading", {name: "Create a liquidity pool"})).toBeVisible();
    await expect(page.getByText("tradebin · liquidity pool")).toBeVisible();

    // The deep link answers the pair.
    const pair = page.getByRole("region", {name: "Pair"});
    await expect(pair).toHaveAttribute("data-state", "done");
    await expect(pair).toContainText("VDL / TBZE");

    const amounts = page.getByRole("region", {name: "Starting amounts"});
    await expect(amounts).toHaveAttribute("data-state", "active");
    await expect(amounts.getByText("This first deposit stays in the pool forever.")).toBeVisible();
    await amounts.getByLabel("VDL").fill("1000");
    await amounts.getByLabel("TBZE").fill("2");
    await expect(amounts.getByTestId("starting-price")).toContainText("1 VDL = 0.002000 TBZE");
    await amounts.getByRole("button", {name: "Continue to fees"}).click();
    await expect(amounts).toContainText("1,000 VDL + 2 TBZE · 0.002000 TBZE per VDL");

    const fees = page.getByRole("region", {name: "Fees"});
    await expect(fees).toHaveAttribute("data-state", "active");
    await fees.getByRole("button", {name: "Review pool"}).click();
    await expect(fees).toContainText("0.2 % · 100 % to providers");

    const review = page.getByRole("region", {name: "Review"});
    await expect(review).toHaveAttribute("data-state", "active");
    const leaves = review.getByRole("region", {name: "Leaves your wallet"});
    await expect(leaves.getByText("Pool creation fee")).toBeVisible();
    await expect(leaves.getByText("25,000 TBZE", {exact: true})).toBeVisible();
    await expect(review.getByRole("region", {name: "You get"})).toContainText("A VDL/TBZE pool anyone can swap in");
    await expect(review.getByRole("region", {name: "Permanent"})).toContainText("The first deposit (1,000 VDL + 2 TBZE)");

    const pay = page.getByRole("region", {name: "You will pay"});
    await expect(pay.getByText("25,000 TBZE", {exact: true})).toBeVisible();

    await expect(review.getByRole("button", {name: "Create pool"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet.")).toBeVisible();
});

test("an existing pair links to its pool on the DEX", async ({page}) => {
    await page.goto(`/pool/new?base=${TUSDC}&quote=ubze`);

    const pair = page.getByRole("region", {name: "Pair"});
    await expect(pair).toHaveAttribute("data-state", "active");
    await expect(pair.getByText("This pair already has a pool. Each pair gets exactly one.")).toBeVisible();
    const link = pair.getByRole("link", {name: /Add liquidity to it on the DEX/});
    await expect(link).toHaveAttribute("href", new RegExp(`/pools/details\\?id=${encodeURIComponent(`${ISSUER}/testusd_ubze`)}$`));
    await expect(pair.getByRole("button", {name: "Continue"})).toBeDisabled();
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`/pool/new?base=${VDL}`);

    await expect(page.getByRole("region", {name: "You will pay"})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
