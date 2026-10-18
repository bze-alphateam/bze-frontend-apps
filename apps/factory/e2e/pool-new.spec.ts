import {expect, test} from "./support/mock-network";

// "Let people buy and sell it" (/pool/new, BFE-148) without a wallet, against the testnet fixtures.
// The fee comes from fixtures/lcd/tradebin.params.json (createMarketFee, charged for pools too:
// 25,000 TBZE); VDL comes from fixtures/lcd/bank.denoms_metadata.json.

const VDL = encodeURIComponent("factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/vidulum");

test("shows the preselected token, the three questions and the pool fee", async ({page}) => {
    await page.goto(`/pool/new?base=${VDL}`);

    await expect(page.getByRole("heading", {name: "Let people buy and sell VDL"})).toBeVisible();
    await expect(page.getByText("tradebin · liquidity pool")).toBeVisible();

    const q1 = page.getByRole("region", {name: "Which pair?"});
    await expect(q1).toHaveAttribute("data-state", "active");
    // The picker's (closed) option list also renders the name; the first match is the selection.
    await expect(q1.getByText("Vidulum", {exact: true}).first()).toBeVisible();
    await expect(page.getByRole("region", {name: "How much to put in?"})).toHaveAttribute("data-state", "todo");
    await expect(page.getByRole("region", {name: "Swap fee and where it goes"})).toHaveAttribute("data-state", "todo");

    const pay = page.getByRole("region", {name: "You will pay"});
    await expect(pay.getByText("Pool creation fee")).toBeVisible();
    await expect(pay.getByText("25,000 TBZE", {exact: true})).toBeVisible();

    await expect(page.getByRole("button", {name: "Create pool"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet to create this pool.")).toBeVisible();
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`/pool/new?base=${VDL}`);

    await expect(page.getByRole("region", {name: "You will pay"})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
