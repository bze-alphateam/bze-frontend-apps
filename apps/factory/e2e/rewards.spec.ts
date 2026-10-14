import {readFileSync} from "node:fs";
import {join} from "node:path";
import {expect, test} from "./support/mock-network";

// The /rewards directory (BFE-153), against fixtures/lcd/rewards.all_denom_rewards.json and the
// noadmin prize and schedule lists.

interface Fixture {
    path: string;
    query: Record<string, string>;
    status: number;
    body: { list: Record<string, unknown>[]; pagination?: unknown };
}

const lcd = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", "lcd", name), "utf8")) as Fixture;

const ALL_DENOM_REWARDS = lcd("rewards.all_denom_rewards.json");
const PRIZES = lcd("rewards.denom_reward_prizes.noadmin.json");
const SCHEDULES = lcd("rewards.denom_reward_schedules.noadmin.json");
const STAKING_REWARDS = lcd("rewards.all_staking_rewards.json");

// The wide-screen table; phones get the stacked cards instead.
const tableRows = (page: import("@playwright/test").Page) =>
    page.getByRole("table", {name: "Holder rewards"}).getByTestId("denom-reward-row");

test("lists one row per denom reward on the chain", async ({page}) => {
    await page.goto("/rewards");

    const rows = tableRows(page);
    await expect(rows).toHaveCount(ALL_DENOM_REWARDS.body.list.length);
    // testnet's one denom reward stakes noadmin, whose metadata names it NoAdminToken.
    await expect(rows.first().getByText("NoAdminToken")).toBeVisible();
    await expect(page.getByRole("columnheader", {name: "Paying"})).toBeVisible();
    await expect(page.getByRole("tab", {name: /Holder rewards/})).toContainText(String(ALL_DENOM_REWARDS.body.list.length));
    await expect(page.getByTestId("denom-reward-empty")).toHaveCount(0);
});

test("the old /denom-reward address lands on /rewards", async ({page}) => {
    await page.goto("/denom-reward?filter=stakers");

    await expect(page).toHaveURL(/\/rewards\?filter=stakers$/);
    await expect(tableRows(page)).toHaveCount(ALL_DENOM_REWARDS.body.list.length);
});

test("Has stakers hides a denom reward nobody stakes", async ({page, network}) => {
    // A second DR, on vidulum, with nothing staked and no prizes or schedules.
    const vidulum = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/vidulum";
    network.use("lcd", {
        ...ALL_DENOM_REWARDS,
        body: {...ALL_DENOM_REWARDS.body, list: [...ALL_DENOM_REWARDS.body.list, {staking_denom: vidulum, lock: 2, min_stake: "0", staked_amount: "0"}]},
    });
    network.use("lcd", {...PRIZES, query: {...PRIZES.query, denom: vidulum}, body: {...PRIZES.body, list: []}});
    network.use("lcd", {...SCHEDULES, query: {...SCHEDULES.query, denom: vidulum}, body: {...SCHEDULES.body, list: []}});
    await page.goto("/rewards");

    const rows = tableRows(page);
    await expect(rows).toHaveCount(2);
    const empty = rows.filter({hasText: "No stakers, nobody to airdrop to"});
    await expect(empty).toHaveCount(1);
    await expect(empty.getByRole("button", {name: "Airdrop"})).toBeDisabled();

    await page.getByRole("button", {name: "Has stakers"}).click();
    await expect(page).toHaveURL(/filter=stakers/);
    await expect(rows).toHaveCount(1);
    await expect(rows.first().getByText("NoAdminToken")).toBeVisible();
});

test("shows the empty state when the chain has no denom reward", async ({page, network}) => {
    network.use("lcd", {...ALL_DENOM_REWARDS, body: {list: [], pagination: {next_key: null, total: "0"}}});
    await page.goto("/rewards");

    await expect(page.getByTestId("denom-reward-empty")).toHaveText(/No token has holder rewards yet/);
    await expect(page.getByTestId("denom-reward-row")).toHaveCount(0);
});

test("opens the Which reward fits? guide from the header", async ({page}) => {
    await page.goto("/rewards");

    await page.getByRole("button", {name: "Which reward fits?"}).click();
    const dialog = page.getByRole("dialog", {name: "Which reward fits?"});
    await expect(dialog.getByText("Most creators start here")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
});

test("fits a phone screen: stacked cards, wrapping filters, no sideways scrolling", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/rewards");

    await expect(page.getByTestId("denom-reward-card")).toHaveCount(ALL_DENOM_REWARDS.body.list.length);
    await expect(page.getByRole("table", {name: "Holder rewards"})).toBeHidden();
    await expect(page.getByRole("button", {name: "Paying now"})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});

test("the guide fits a phone screen without sideways scrolling", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/rewards");

    await page.getByRole("button", {name: "Which reward fits?"}).click();
    const dialog = page.getByRole("dialog", {name: "Which reward fits?"});
    await expect(dialog.getByTestId("reward-comparison-stacked")).toBeVisible();
    await expect(dialog.getByRole("table", {name: "Rewards compared"})).toBeHidden();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});

test("Staking programs: running first, finished folded away", async ({page, network}) => {
    // testnet's one program has paid all its days; add a running one after it in chain order.
    const [finished] = STAKING_REWARDS.body.list;
    const running = {...finished, reward_id: "000000000001", payouts: 3, duration: 30};
    network.use("lcd", {...STAKING_REWARDS, body: {...STAKING_REWARDS.body, list: [finished, running]}});
    await page.goto("/rewards?tab=programs");

    await expect(page.getByRole("tab", {name: /Staking programs/})).toContainText("1 running");
    const rows = page.getByTestId("staking-program-row");
    await expect(rows).toHaveCount(1);
    await expect(rows.first().getByText("#000000000001")).toBeVisible();

    const toggle = page.getByRole("button", {name: "Finished (1)"});
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(1).getByText("#000000000000")).toBeVisible();
    // 37 staked: the finished program can't be deleted yet, and says why.
    await expect(rows.nth(1).getByTestId("staking-reward-delete-blocker")).toContainText("still staked");

    await page.getByRole("button", {name: "Running", exact: true}).click();
    await expect(page).toHaveURL(/status=running/);
    await expect(page.getByRole("button", {name: "Finished (1)"})).toHaveCount(0);
    await expect(rows).toHaveCount(1);
});

test("Staking programs fit a phone screen", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/rewards?tab=programs&status=finished");

    await expect(page.getByTestId("staking-program-row")).toHaveCount(STAKING_REWARDS.body.list.length);
    // Name what sticks out, so a failure says where to look.
    const sticksOut = await page.evaluate(() => Array.from(document.querySelectorAll("body *"))
        .filter(el => el.getBoundingClientRect().right > window.innerWidth + 0.5)
        .map(el => `${el.tagName.toLowerCase()}.${(el.getAttribute("class") ?? "").split(" ").slice(0, 2).join(".")} [${el.getAttribute("data-testid") ?? el.getAttribute("aria-label") ?? (el.textContent ?? "").slice(0, 30)}] right=${Math.round(el.getBoundingClientRect().right)}`));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, sticksOut.join("\n")).toBeLessThanOrEqual(0);
});
