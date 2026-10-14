import {readFileSync} from "node:fs";
import {join} from "node:path";
import {expect, test} from "./support/mock-network";

// The /denom-reward directory, against fixtures/lcd/rewards.all_denom_rewards.json.

interface DenomRewardsFixture {
    path: string;
    query: Record<string, string>;
    body: { list: { staking_denom: string }[] };
}

const ALL_DENOM_REWARDS = JSON.parse(
    readFileSync(join(__dirname, "fixtures", "lcd", "rewards.all_denom_rewards.json"), "utf8"),
) as DenomRewardsFixture;

test("lists one row per denom reward on the chain", async ({page}) => {
    await page.goto("/denom-reward");

    const rows = page.getByTestId("denom-reward-row");
    await expect(rows).toHaveCount(ALL_DENOM_REWARDS.body.list.length);
    // testnet's one denom reward stakes noadmin, whose metadata names it NoAdminToken.
    await expect(rows.first().getByText("NoAdminToken")).toBeVisible();
    await expect(rows.first().getByText("Running schedules")).toBeVisible();
    await expect(page.getByTestId("denom-reward-empty")).toHaveCount(0);
});

test("shows the empty state when the chain has no denom reward", async ({page, network}) => {
    network.use("lcd", {
        path: ALL_DENOM_REWARDS.path,
        query: ALL_DENOM_REWARDS.query,
        status: 200,
        body: {list: [], pagination: {next_key: null, total: "0"}},
    });
    await page.goto("/denom-reward");

    await expect(page.getByTestId("denom-reward-empty")).toHaveText(/No token has a denom reward yet/);
    await expect(page.getByTestId("denom-reward-row")).toHaveCount(0);
});

test("opens the Which reward fits? guide from the header", async ({page}) => {
    await page.goto("/denom-reward");

    await page.getByRole("button", {name: "Which reward fits?"}).click();
    const dialog = page.getByRole("dialog", {name: "Which reward fits?"});
    await expect(dialog.getByText("Most creators start here")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
});

test("the guide fits a phone screen without sideways scrolling", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/denom-reward");

    await page.getByRole("button", {name: "Which reward fits?"}).click();
    const dialog = page.getByRole("dialog", {name: "Which reward fits?"});
    await expect(dialog.getByTestId("reward-comparison-stacked")).toBeVisible();
    await expect(dialog.getByRole("table", {name: "Rewards compared"})).toBeHidden();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
