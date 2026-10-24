import {readFileSync} from "node:fs";
import {join} from "node:path";
import {expect, test} from "./support/mock-network";

// The /rewards directory (BFE-153, rebuilt in BFE-272, one row per staked token since canvas C-2), against fixtures/lcd/rewards.all_denom_rewards.json
// (testnet's one compounded reward, on noadmin = NOAD, with two daily prizes) and
// rewards.all_staking_rewards.json (one finished simple reward on vidulum = VDL, 37 VDL still staked).

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

const ISSUER = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";
const NOADMIN = `${ISSUER}/noadmin`;
const VIDULUM = `${ISSUER}/vidulum`;

type Page = import("@playwright/test").Page;

const rows = (page: Page) => page.getByTestId("reward-group");
const row = (page: Page, denom: string) => page.locator(`[data-testid="reward-group"][data-denom="${denom}"]`);
const open = (page: Page, denom: string) => row(page, denom).getByRole("button", {expanded: false}).first().click();
const compoundedItems = (page: Page) => page.getByTestId("compounded-item");
const simpleItems = (page: Page) => page.getByTestId("simple-reward-row");

test("lists one row per staked token; open, the actions anyone can take", async ({page}) => {
    await page.goto("/rewards");

    await expect(page.getByRole("heading", {level: 1, name: "Rewards"})).toBeVisible();
    await expect(page.getByRole("link", {name: "Create a reward"})).toHaveAttribute("href", "/create/rewards");
    await expect(rows(page)).toHaveCount(2);
    await expect(page.getByTestId("rewards-count")).toHaveText("2 tokens · 2 rewards");

    await open(page, NOADMIN);
    const compounded = row(page, NOADMIN).getByTestId("compounded-item");
    await expect(compounded.getByTestId("reward-spec")).toContainText("Paying daily");
    await expect(compounded.getByTestId("daily-prize-line")).toHaveCount(SCHEDULES.body.list.length);
    await expect(compounded.getByTestId("daily-prize-line").first()).toContainText(" / day · ");
    await expect(compounded.getByRole("link", {name: "Add daily prize"})).toHaveAttribute("href", `/denom-reward/schedule?denom=${encodeURIComponent(NOADMIN)}`);
    await expect(compounded.getByRole("link", {name: "Airdrop", exact: true})).toHaveAttribute("href", `/airdrop?to=stakers&denom=${encodeURIComponent(NOADMIN)}`);
    await expect(compounded.getByRole("link", {name: "Extend", exact: true}).first())
        .toHaveAttribute("href", `/denom-reward/schedule?denom=${encodeURIComponent(NOADMIN)}&schedule=000000000000`);
    const dex = compounded.getByRole("link", {name: /DEX/});
    await expect(dex).toHaveAttribute("href", new RegExp(`/staking/details\\?id=compounded%3A${encodeURIComponent(NOADMIN)}$`));
    await expect(dex).toHaveAttribute("target", "_blank");
    // "Last paid" is gone, and staker counts are not on the chain (epic decision 12).
    await expect(row(page, NOADMIN)).not.toContainText("Last paid");
    await expect(row(page, NOADMIN)).not.toContainText("stakers");

    await open(page, VIDULUM);
    const simple = row(page, VIDULUM).getByTestId("simple-reward-row");
    await expect(simple.getByText("#000000000000")).toBeVisible();
    await expect(simple.getByTestId("reward-spec")).toContainText("Finished");
    await expect(simple.getByRole("link", {name: "Extend"})).toHaveAttribute("href", "/reward/extend?id=000000000000");
    await expect(simple.getByRole("link", {name: "Airdrop", exact: true})).toHaveAttribute("href", `/airdrop?to=stakers&denom=${encodeURIComponent(VIDULUM)}&id=000000000000`);
    await expect(simple.getByRole("link", {name: /DEX/})).toHaveAttribute("href", /\/staking\/details\?id=simple%3A000000000000$/);
    // 37 VDL staked: the finished reward can't be deleted yet.
    await expect(simple.getByRole("button", {name: "Delete"})).toHaveCount(0);
    // No compounded reward on VDL: anyone can make it stakable.
    await expect(row(page, VIDULUM).getByRole("link", {name: "Make VDL stakable"})).toHaveAttribute("href", `/denom-reward/new?denom=${encodeURIComponent(VIDULUM)}`);
});

test("the kind chips keep one kind and write it to the URL; an old tab= maps to its kind", async ({page}) => {
    await page.goto("/rewards");
    await expect(rows(page)).toHaveCount(2);

    await page.getByRole("group", {name: "Kind"}).getByRole("button", {name: "Simple"}).click();
    await expect(page).toHaveURL(/kind=simple/);
    await expect(rows(page)).toHaveCount(1);
    await expect(simpleItems(page)).toHaveCount(1);
    await expect(compoundedItems(page)).toHaveCount(0);

    await page.goto("/rewards?tab=holder");
    await expect(rows(page)).toHaveCount(1);
    await expect(compoundedItems(page)).toHaveCount(1);
    await expect(simpleItems(page)).toHaveCount(0);
});

test("searches by staked token", async ({page}) => {
    await page.goto("/rewards");
    await expect(rows(page)).toHaveCount(2);

    await page.getByRole("textbox", {name: "Search by staked token"}).fill("vdl");
    await expect(page).toHaveURL(/q=vdl/);
    await expect(rows(page)).toHaveCount(1);
    await expect(simpleItems(page)).toHaveCount(1);

    await page.getByRole("textbox", {name: "Search by staked token"}).fill("zzz");
    await expect(page.getByTestId("rewards-no-match")).toHaveText("No reward stakes a token matching 'zzz'.");
});

test("the old /denom-reward addresses land on /rewards, a token's on its open row", async ({page}) => {
    await page.goto("/denom-reward");
    await expect(page).toHaveURL(/\/rewards$/);

    await page.goto(`/denom-reward/token?denom=${encodeURIComponent(NOADMIN)}`);
    await expect(page).toHaveURL(/\/rewards\?denom=/);
    await expect(page.getByRole("textbox", {name: "Search by staked token"})).toHaveValue(NOADMIN);
    await expect(rows(page)).toHaveCount(1);
    await expect(compoundedItems(page)).toHaveCount(1);
    await expect(simpleItems(page)).toHaveCount(0);
});

test("Has stakers hides a compounded reward nobody stakes; its airdrop is disabled", async ({page, network}) => {
    // A second DR, on vidulum, with nothing staked and no prizes or schedules.
    network.use("lcd", {
        ...ALL_DENOM_REWARDS,
        body: {...ALL_DENOM_REWARDS.body, list: [...ALL_DENOM_REWARDS.body.list, {staking_denom: VIDULUM, lock: 2, min_stake: "0", staked_amount: "0"}]},
    });
    network.use("lcd", {...PRIZES, query: {...PRIZES.query, denom: VIDULUM}, body: {...PRIZES.body, list: []}});
    network.use("lcd", {...SCHEDULES, query: {...SCHEDULES.query, denom: VIDULUM}, body: {...SCHEDULES.body, list: []}});
    await page.goto("/rewards?kind=compounded");

    await expect(rows(page)).toHaveCount(2);
    await open(page, VIDULUM);
    const empty = row(page, VIDULUM).getByTestId("compounded-item");
    await expect(empty.getByText("Nothing scheduled")).toBeVisible();
    await expect(empty.getByRole("button", {name: "Airdrop", exact: true})).toBeDisabled();

    await page.getByRole("combobox", {name: "Filter"}).selectOption("stakers");
    await expect(page).toHaveURL(/filter=stakers/);
    await expect(rows(page)).toHaveCount(1);
    await expect(row(page, NOADMIN)).toHaveCount(1);
});

test("shows the empty state with a create button when the chain has no reward", async ({page, network}) => {
    network.use("lcd", {...ALL_DENOM_REWARDS, body: {list: [], pagination: {next_key: null, total: "0"}}});
    network.use("lcd", {...STAKING_REWARDS, body: {list: [], pagination: {next_key: null, total: "0"}}});
    await page.goto("/rewards");

    await expect(page.getByText("No staking rewards yet.")).toBeVisible();
    await expect(page.getByRole("link", {name: "Make a token stakable"})).toHaveAttribute("href", "/denom-reward/new");
});

test("Simple rewards: running first in their row, Running and Finished in the URL", async ({page, network}) => {
    // testnet's one reward has paid all its days; add a running one after it in chain order.
    const [finished] = STAKING_REWARDS.body.list;
    const running = {...finished, reward_id: "000000000001", payouts: 3, duration: 30};
    network.use("lcd", {...STAKING_REWARDS, body: {...STAKING_REWARDS.body, list: [finished, running]}});
    await page.goto("/rewards?kind=simple");

    // One row left, so it starts open.
    const items = simpleItems(page);
    await expect(items).toHaveCount(2);
    await expect(items.first().getByText("#000000000001")).toBeVisible();
    await expect(items.first().getByRole("button", {name: "Delete"})).toHaveCount(0);

    await page.getByRole("combobox", {name: "Filter"}).selectOption("running");
    await expect(page).toHaveURL(/filter=running/);
    await expect(items).toHaveCount(1);

    await page.getByRole("combobox", {name: "Filter"}).selectOption("finished");
    await expect(page).toHaveURL(/filter=finished/);
    await expect(items).toHaveCount(1);
    await expect(items.first().getByText("#000000000000")).toBeVisible();
});

test("fits a phone screen: stacked rows, wrapping controls, no sideways scrolling", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/rewards");

    await expect(rows(page)).toHaveCount(2);
    await open(page, NOADMIN);
    await open(page, VIDULUM);
    await expect(compoundedItems(page)).toHaveCount(1);
    await expect(simpleItems(page)).toHaveCount(1);
    await expect(page.getByRole("combobox", {name: "Filter"})).toBeVisible();
    // Right after the rows appear the page can still be settling, so wait for it; a lasting overflow fails.
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await expect.poll(overflow, {timeout: 5000}).toBeLessThanOrEqual(0);
});
