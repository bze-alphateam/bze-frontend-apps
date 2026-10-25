import {expect, test} from "./support/mock-network";

// "Extend a reward" (/reward/extend, BFE-264) without a wallet, against the testnet fixtures.
// fixtures/lcd/rewards.all_staking_rewards.json holds one simple reward, #000000000000: stake VDL,
// earn 10 VDL a day, all 15 days paid. A finished reward can be extended: it pays again from today.

const REWARD_ID = "000000000000";

test.beforeEach(async ({page}) => {
    // "Today" is 20 Oct 2026, so the new end date is known.
    await page.clock.setFixedTime(new Date(2026, 9, 20, 12));
});

test("shows the reward's read-only terms and the new end date", async ({page}) => {
    await page.goto(`/reward/extend?id=${REWARD_ID}`);

    await expect(page.getByRole("heading", {name: "Extend a reward"})).toBeVisible();
    const crumbs = page.getByRole("navigation", {name: "Breadcrumb"});
    await expect(crumbs).toContainText("Rewards");
    await expect(crumbs).toContainText("Extend");

    const reward = page.getByRole("region", {name: "Reward", exact: true});
    await expect(reward).toHaveAttribute("data-state", "done");
    await expect(reward).toContainText("Stake VDL · earn 10 VDL a day");

    const days = page.getByRole("region", {name: "Extra days", exact: true});
    await expect(days).toHaveAttribute("data-state", "active");
    const terms = days.getByTestId("extend-terms");
    await expect(terms).toContainText("Stake");
    await expect(terms).toContainText("Daily reward");
    await expect(terms).toContainText("10 VDL");
    await expect(terms).toContainText("End date");
    await expect(terms).toContainText("Ended");

    await days.getByLabel("Extra days").fill("10");
    await expect(days.getByTestId("extend-new-end")).toContainText("New end date");

    await days.getByRole("button", {name: "Review extension"}).click();
    const review = page.getByRole("region", {name: "Review", exact: true});
    await expect(review).toHaveAttribute("data-state", "active");
    await expect(review.getByRole("region", {name: "You get"})).toContainText("10 more days");
    await expect(review.getByRole("region", {name: "You get"})).not.toContainText("for everyone staking");
    await expect(review.getByRole("region", {name: "Permanent"})).toContainText("Rewards are committed to stakers");
    await expect(review.getByRole("button", {name: "Extend", exact: true})).toBeDisabled();
    await expect(page.getByText("Connect your wallet.")).toBeVisible();
});

test("tells an unknown reward apart", async ({page}) => {
    await page.goto("/reward/extend?id=999999999999");
    await expect(page.getByText("We couldn't find reward #999999999999.")).toBeVisible();
    await expect(page.getByRole("button", {name: /See all rewards/})).toBeVisible();
});

test("without an id, lists the running rewards (testnet has none running)", async ({page}) => {
    await page.goto("/reward/extend");
    await expect(page.getByRole("region", {name: "Reward", exact: true})).toHaveAttribute("data-state", "active");
    await expect(page.getByTestId("extend-reward-empty")).toHaveText("No simple reward is running right now.");
});
