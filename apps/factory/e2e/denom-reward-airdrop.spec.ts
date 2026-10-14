import {readFileSync} from "node:fs";
import {join} from "node:path";
import {expect, test} from "./support/mock-network";

// "Gift <STAKE> stakers, once" (/denom-reward/airdrop, BFE-159) without a wallet, against the testnet
// fixtures: the noadmin denom reward (fixtures/lcd/rewards.denom_reward.noadmin.json, 25 NOAD staked)
// and its prizes. The no-stakers case answers the same denom reward with nothing staked, through
// network.use.

const DENOM = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
const NOADMIN = encodeURIComponent(DENOM);

const DENOM_REWARD = JSON.parse(readFileSync(join(__dirname, "fixtures", "lcd", "rewards.denom_reward.noadmin.json"), "utf8"));

test("shows the two questions and the connect message", async ({page}) => {
    await page.goto(`/denom-reward/airdrop?denom=${NOADMIN}`);

    await expect(page.getByRole("heading", {name: /Gift NOAD stakers, once/})).toBeVisible();
    await expect(page.getByText("rewards · distribute denom rewards")).toBeVisible();
    await expect(page.getByTestId("airdrop-blocker")).toHaveCount(0);

    await expect(page.getByRole("region", {name: "What do you give?"})).toHaveAttribute("data-state", "active");
    await expect(page.getByRole("region", {name: "How much?"})).toHaveAttribute("data-state", "todo");

    await expect(page.getByRole("button", {name: "Airdrop now"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet to airdrop.")).toBeVisible();
});

test("refuses a denom reward nobody is staking", async ({page, network}) => {
    network.use("lcd", {
        ...DENOM_REWARD,
        body: {denom_reward: {...DENOM_REWARD.body.denom_reward, staked_amount: "0"}},
    });
    await page.goto(`/denom-reward/airdrop?denom=${NOADMIN}`);

    await expect(page.getByTestId("airdrop-blocker")).toContainText("Nobody is staking this token yet");
    await expect(page.getByRole("button", {name: "Airdrop now"})).toBeDisabled();
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`/denom-reward/airdrop?denom=${NOADMIN}`);

    await expect(page.getByRole("button", {name: "Airdrop now"})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
