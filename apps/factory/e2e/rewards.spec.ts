import {readFileSync} from "node:fs";
import {join} from "node:path";
import {expect, test} from "./support/mock-network";

// The /rewards directory (BFE-153, rebuilt in BFE-272), against fixtures/lcd/rewards.all_denom_rewards.json
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

const compoundedCards = (page: import("@playwright/test").Page) => page.getByTestId("compounded-reward-card");
const simpleRows = (page: import("@playwright/test").Page) => page.getByTestId("simple-reward-row");

test("lists every compounded and simple reward with the actions anyone can take", async ({page}) => {
    await page.goto("/rewards");

    await expect(page.getByRole("heading", {level: 1, name: "Rewards"})).toBeVisible();
    await expect(page.getByRole("link", {name: "Create a reward"})).toHaveAttribute("href", "/create/rewards");

    const card = compoundedCards(page);
    await expect(card).toHaveCount(ALL_DENOM_REWARDS.body.list.length);
    await expect(card.getByRole("heading", {name: "Stake NOAD"})).toBeVisible();
    await expect(card.getByTestId("daily-prize-line")).toHaveCount(SCHEDULES.body.list.length);
    await expect(card.getByTestId("prize-token-line")).toHaveCount(PRIZES.body.list.length);
    await expect(card.getByRole("link", {name: "Add daily prize"})).toHaveAttribute("href", `/denom-reward/schedule?denom=${encodeURIComponent(NOADMIN)}`);
    await expect(card.getByRole("link", {name: "Airdrop once"})).toHaveAttribute("href", `/denom-reward/airdrop?denom=${encodeURIComponent(NOADMIN)}`);
    await expect(card.getByRole("link", {name: "Extend →"}).first())
        .toHaveAttribute("href", `/denom-reward/schedule?denom=${encodeURIComponent(NOADMIN)}&schedule=000000000000`);
    await expect(card.getByRole("link", {name: "Open token"})).toHaveAttribute("href", `/tokens/token?denom=${encodeURIComponent(NOADMIN)}`);
    // Staker counts are not on the chain (epic decision 12).
    await expect(card).not.toContainText("stakers");

    const row = simpleRows(page);
    await expect(row).toHaveCount(STAKING_REWARDS.body.list.length);
    await expect(row.getByRole("heading", {name: "Stake VDL · earn VDL"})).toBeVisible();
    await expect(row.getByText("finished", {exact: true})).toBeVisible();
    await expect(row.getByRole("link", {name: "Extend"})).toHaveAttribute("href", "/reward/extend?id=000000000000");
    // 37 VDL staked: the finished reward can't be deleted yet, and says why.
    await expect(row.getByRole("button", {name: "Delete"})).toBeDisabled();
    await expect(row.getByTestId("staking-reward-delete-blocker")).toContainText("still staked");
});

test("the kind chips show one section and write it to the URL; an old tab= maps to its kind", async ({page}) => {
    await page.goto("/rewards");
    await expect(compoundedCards(page)).toHaveCount(1);

    await page.getByRole("group", {name: "Kind"}).getByRole("button", {name: "Simple"}).click();
    await expect(page).toHaveURL(/kind=simple/);
    await expect(compoundedCards(page)).toHaveCount(0);
    await expect(simpleRows(page)).toHaveCount(1);

    await page.goto("/rewards?tab=holder");
    await expect(compoundedCards(page)).toHaveCount(1);
    await expect(page.getByRole("region", {name: "Simple rewards"})).toHaveCount(0);
});

test("searches by staked token", async ({page}) => {
    await page.goto("/rewards");
    await expect(compoundedCards(page)).toHaveCount(1);

    await page.getByRole("textbox", {name: "Search by staked token"}).fill("vdl");
    await expect(page).toHaveURL(/q=vdl/);
    await expect(compoundedCards(page)).toHaveCount(0);
    await expect(page.getByTestId("compounded-no-match")).toHaveText("No reward stakes a token matching 'vdl'.");
    await expect(simpleRows(page)).toHaveCount(1);
});

test("the old /denom-reward addresses land on /rewards, a token's on its card", async ({page}) => {
    await page.goto("/denom-reward");
    await expect(page).toHaveURL(/\/rewards$/);

    await page.goto(`/denom-reward/token?denom=${encodeURIComponent(NOADMIN)}`);
    await expect(page).toHaveURL(/\/rewards\?denom=/);
    await expect(page.getByRole("textbox", {name: "Search by staked token"})).toHaveValue(NOADMIN);
    await expect(compoundedCards(page)).toHaveCount(1);
    await expect(simpleRows(page)).toHaveCount(0);
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

    const cards = compoundedCards(page);
    await expect(cards).toHaveCount(2);
    const empty = cards.filter({hasText: "Nothing staked yet"});
    await expect(empty).toHaveCount(1);
    await expect(empty.getByRole("button", {name: "Airdrop once"})).toBeDisabled();

    await page.getByRole("button", {name: "Has stakers"}).click();
    await expect(page).toHaveURL(/filter=stakers/);
    await expect(cards).toHaveCount(1);
    await expect(cards.getByRole("heading", {name: "Stake NOAD"})).toBeVisible();
});

test("shows the empty states with a create button when the chain has no reward", async ({page, network}) => {
    network.use("lcd", {...ALL_DENOM_REWARDS, body: {list: [], pagination: {next_key: null, total: "0"}}});
    network.use("lcd", {...STAKING_REWARDS, body: {list: [], pagination: {next_key: null, total: "0"}}});
    await page.goto("/rewards");

    await expect(page.getByText("No compounded rewards yet.")).toBeVisible();
    await expect(page.getByRole("link", {name: "Make a token stakable"})).toHaveAttribute("href", "/denom-reward/new");
    await expect(page.getByText("No simple rewards yet.")).toBeVisible();
    await expect(page.getByRole("link", {name: "Create a simple reward"})).toHaveAttribute("href", "/reward/new");
});

test("Simple rewards: running first, the status chips in the URL", async ({page, network}) => {
    // testnet's one reward has paid all its days; add a running one after it in chain order.
    const [finished] = STAKING_REWARDS.body.list;
    const running = {...finished, reward_id: "000000000001", payouts: 3, duration: 30};
    network.use("lcd", {...STAKING_REWARDS, body: {...STAKING_REWARDS.body, list: [finished, running]}});
    await page.goto("/rewards?kind=simple");

    const rows = simpleRows(page);
    await expect(rows).toHaveCount(2);
    await expect(rows.first().getByText("#000000000001")).toBeVisible();
    await expect(rows.first().getByRole("button", {name: "Delete"})).toHaveCount(0);

    await page.getByRole("button", {name: "Running", exact: true}).click();
    await expect(page).toHaveURL(/status=running/);
    await expect(rows).toHaveCount(1);

    await page.getByRole("button", {name: "Finished", exact: true}).click();
    await expect(page).toHaveURL(/status=finished/);
    await expect(rows).toHaveCount(1);
    await expect(rows.first().getByText("#000000000000")).toBeVisible();
});

test("fits a phone screen: stacked cards, wrapping chips, no sideways scrolling", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/rewards");

    await expect(compoundedCards(page)).toHaveCount(1);
    await expect(simpleRows(page)).toHaveCount(1);
    await expect(page.getByRole("button", {name: "Paying now"})).toBeVisible();
    // Right after the rows appear the page can still be settling, so wait for it; a lasting overflow fails.
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await expect.poll(overflow, {timeout: 5000}).toBeLessThanOrEqual(0);
});
