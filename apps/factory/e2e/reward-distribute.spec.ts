import {expect, test} from "./support/mock-network";

// "Distribute to stakers" (/reward/distribute) without a wallet, against the testnet fixtures.
// fixtures/lcd/rewards.all_staking_rewards.json holds one simple reward, #000000000000: stake VDL,
// paid in VDL, all 15 days paid, 37 VDL staked. A finished reward with stakers still takes a distribution.

const REWARD_ID = "000000000000";

test.beforeEach(async ({page}) => {
    await page.clock.setFixedTime(new Date(2026, 9, 20, 12));
});

test("previews the split of a one-time amount, then asks for a wallet", async ({page}) => {
    await page.goto(`/reward/distribute?id=${REWARD_ID}`);

    await expect(page.getByRole("heading", {name: "Distribute to stakers"})).toBeVisible();
    const crumbs = page.getByRole("navigation", {name: "Breadcrumb"});
    await expect(crumbs).toContainText("Rewards");
    await expect(crumbs).toContainText("Distribute");

    const reward = page.getByRole("region", {name: "Reward", exact: true});
    await expect(reward).toHaveAttribute("data-state", "done");
    await expect(reward).toContainText("Stake VDL · paid in VDL");

    const amount = page.getByRole("region", {name: "Amount", exact: true});
    await expect(amount).toHaveAttribute("data-state", "active");
    const terms = amount.getByTestId("distribute-terms");
    await expect(terms).toContainText("Paid in");
    await expect(terms).toContainText("37 VDL");
    await expect(amount.getByText("This reward has finished.")).toBeVisible();

    await amount.getByLabel("Amount (VDL)").fill("5");
    await expect(amount.getByTestId("distribute-sentence"))
        .toContainText("5 VDL is split between everyone staking VDL right now");

    await amount.getByRole("button", {name: "Review", exact: true}).click();
    const review = page.getByRole("region", {name: "Review", exact: true});
    await expect(review).toHaveAttribute("data-state", "active");
    await expect(review.getByRole("button", {name: "Distribute now"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet to distribute.")).toBeVisible();
});

test("tells an unknown reward apart", async ({page}) => {
    await page.goto("/reward/distribute?id=999999999999");
    await expect(page.getByText("We couldn't find reward #999999999999.")).toBeVisible();
});

test("without an id, lists the rewards with stakers", async ({page}) => {
    await page.goto("/reward/distribute");
    await expect(page.getByRole("region", {name: "Reward", exact: true})).toHaveAttribute("data-state", "active");
    await expect(page.getByTestId("distribute-reward-option")).toHaveCount(1);
    await expect(page.getByTestId("distribute-reward-option")).toContainText("Stake VDL · paid in VDL");
});
