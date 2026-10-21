import {readFileSync} from "node:fs";
import {join} from "node:path";
import {expect, test} from "./support/mock-network";

// The compounded reward panel on /denom-reward/token (BFE-158) without a wallet, against the testnet
// fixtures: the noadmin denom reward with its two daily prizes, and testusd, which has none (the
// chain answers 404, given here with network.use), with the fee from fixtures/lcd/rewards.params.json.

const NOADMIN = encodeURIComponent("factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin");
const TESTUSD = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/testusd";

const DENOM_REWARD = JSON.parse(readFileSync(join(__dirname, "fixtures", "lcd", "rewards.denom_reward.noadmin.json"), "utf8"));

test("a live denom reward: Live badge, its daily prizes and Airdrop now", async ({page}) => {
    await page.goto(`/denom-reward/token?denom=${NOADMIN}`);

    const panel = page.getByRole("region", {name: "Compounded reward"});
    await expect(panel.getByText("Compounded reward", {exact: true})).toBeVisible();
    await expect(panel.getByText("Live", {exact: true})).toBeVisible();

    const rows = panel.getByRole("table", {name: "Daily prizes"}).getByTestId("holder-schedule-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("2 of 200 payout days");
    await expect(rows.nth(1)).toContainText("2 of 365 payout days");
    await expect(panel.getByTestId("holder-prize")).toHaveCount(2);
    await expect(panel.getByRole("button", {name: "Airdrop now"})).toBeVisible();
    await expect(page.getByRole("button", {name: "Rewards", exact: true})).toBeVisible();
});

test("a token without one: Make it stakable links to the wizard", async ({page, network}) => {
    network.use("lcd", {
        ...DENOM_REWARD,
        query: {denom: TESTUSD},
        status: 404,
        body: {code: 5, message: "denom reward not found", details: []},
    });
    await page.goto(`/denom-reward/token?denom=${encodeURIComponent(TESTUSD)}`);

    const panel = page.getByRole("region", {name: "Compounded reward"});
    await expect(panel.getByText(/Holders have no reason to stake TUSDC yet/)).toBeVisible();
    await expect(panel.getByText("Live", {exact: true})).toHaveCount(0);
    // The fee and the signing moved to /denom-reward/new (BFE-265).
    await expect(panel.getByRole("link", {name: "Make TUSDC stakable"}))
        .toHaveAttribute("href", new RegExp(`^/denom-reward/new\\?denom=${encodeURIComponent(TESTUSD)}&return=`));
});

test("fits a 390 px phone: daily prizes as cards, no horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`/denom-reward/token?denom=${NOADMIN}`);

    await expect(page.getByTestId("holder-schedule-card")).toHaveCount(2);
    await expect(page.getByRole("table", {name: "Daily prizes"})).toBeHidden();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
