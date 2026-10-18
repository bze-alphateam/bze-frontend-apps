import {expect, test} from "./support/mock-network";

// "Run a campaign with an end date" (/reward/new, BFE-150) without a wallet, against the testnet fixtures.
// The TUSDC/TBZE LP token comes from fixtures/lcd/tradebin.all_liquidity_pools.json; the fee from
// fixtures/lcd/rewards.params.json (createStakingRewardFee: 25,000 TBZE).

const TUSDC_TBZE_LP = encodeURIComponent("ulp_factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/testusd_ubze");

test("shows the preselected LP token, the staking program fee and the connect message", async ({page}) => {
    await page.goto(`/reward/new?staking=${TUSDC_TBZE_LP}`);

    await expect(page.getByRole("heading", {name: /Run a campaign with an end date/})).toBeVisible();
    await expect(page.getByText("rewards · staking reward")).toBeVisible();

    // The deep link answers question 1.
    const q1 = page.getByRole("region", {name: "What do people stake?"});
    await expect(q1).toHaveAttribute("data-state", "done");
    await expect(q1).toContainText("TUSDC/TBZE LP");
    await expect(page.getByRole("region", {name: "What do they earn, and for how long?"})).toHaveAttribute("data-state", "active");
    await expect(page.getByRole("region", {name: "Rules for stakers"})).toHaveAttribute("data-state", "todo");

    const pay = page.getByRole("region", {name: "You will pay"});
    await expect(pay.getByText("Staking program fee")).toBeVisible();
    await expect(pay.getByText("25,000 TBZE", {exact: true})).toBeVisible();

    await expect(page.getByRole("button", {name: "Start the program"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet to create this reward.")).toBeVisible();

    await page.getByRole("button", {name: "Which reward fits?"}).click();
    await expect(page.getByRole("dialog", {name: "Which reward fits?"})).toBeVisible();
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`/reward/new?staking=${TUSDC_TBZE_LP}`);

    await expect(page.getByRole("region", {name: "You will pay"})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
