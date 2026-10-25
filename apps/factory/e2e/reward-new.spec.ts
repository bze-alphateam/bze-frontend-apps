import {expect, test} from "./support/mock-network";

// "Create a simple reward" (/reward/new, BFE-264) without a wallet, against the testnet fixtures.
// The TUSDC/TBZE LP token comes from fixtures/lcd/tradebin.all_liquidity_pools.json; the fee from
// fixtures/lcd/rewards.params.json (createStakingRewardFee: 25,000 TBZE).

const TUSDC_TBZE_LP = encodeURIComponent("ulp_factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/testusd_ubze");

test("walks from the preselected LP token to Review, with the fee and the connect message", async ({page}) => {
    await page.goto(`/reward/new?staking=${TUSDC_TBZE_LP}`);

    await expect(page.getByRole("heading", {name: /Create a simple reward/})).toBeVisible();
    await expect(page.getByText("rewards · staking reward")).toBeVisible();
    await expect(page.getByRole("link", {name: "Compare the kinds of reward"})).toHaveAttribute("href", "/create/rewards");

    // The deep link answers step 1.
    const stake = page.getByRole("region", {name: "What to stake"});
    await expect(stake).toHaveAttribute("data-state", "done");
    await expect(stake).toContainText("Stake TUSDC/TBZE LP");

    const budget = page.getByRole("region", {name: "Reward & budget"});
    await expect(budget).toHaveAttribute("data-state", "active");
    // The reward token: VDL, through the picker's search.
    await budget.getByRole("combobox").click();
    await page.getByPlaceholder("Search by name or ticker...").fill("VDL");
    await page.getByRole("option").filter({hasText: "VDL"}).first().click();
    await budget.getByLabel(/Shared every day/).fill("100");
    await budget.getByRole("button", {name: "30 days"}).click();
    await expect(budget.getByTestId("budget-line")).toHaveText("100 VDL/day × 30 days = 3,000 VDL committed now");
    await budget.getByRole("button", {name: "Continue to rules"}).click();
    await expect(budget).toContainText("100 VDL a day for 30 days");

    const rules = page.getByRole("region", {name: "Rules"});
    await expect(rules).toContainText("Stakers can leave any time.");
    await rules.getByRole("button", {name: "Review reward"}).click();
    await expect(rules).toContainText("No lock · no minimum");

    const review = page.getByRole("region", {name: "Review"});
    await expect(review).toHaveAttribute("data-state", "active");
    await expect(review.getByRole("region", {name: "Leaves your wallet"})).toContainText("25,000 TBZE");
    await expect(review.getByRole("region", {name: "Leaves your wallet"})).toContainText("3,000 VDL");
    await expect(review.getByRole("region", {name: "You get"})).toContainText("A simple reward anyone can stake in");
    await expect(review.getByRole("button", {name: "Create simple reward"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet.")).toBeVisible();
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`/reward/new?staking=${TUSDC_TBZE_LP}`);

    await expect(page.getByRole("region", {name: "You will pay"})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
