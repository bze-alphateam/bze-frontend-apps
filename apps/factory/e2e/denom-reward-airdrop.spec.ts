import {readFileSync} from "node:fs";
import {join} from "node:path";
import {expect, test} from "./support/mock-network";

// The Airdrop to stakers wizard (/denom-reward/airdrop, BFE-268) without a wallet, against the
// testnet fixtures: the noadmin compounded reward (fixtures/lcd/rewards.denom_reward.noadmin.json,
// 25 NOAD staked) and its prizes (NOAD and VDL). The no-stakers cases answer with nothing staked,
// through network.use.

const DENOM = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
const NOADMIN = encodeURIComponent(DENOM);

const read = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", "lcd", name), "utf8"));
const DENOM_REWARD = read("rewards.denom_reward.noadmin.json");
const ALL_DENOM_REWARDS = read("rewards.all_denom_rewards.json");

test("airdrops to NOAD stakers and reaches Review with the connect message", async ({page}) => {
    await page.goto(`/denom-reward/airdrop?denom=${NOADMIN}`);

    await expect(page.getByRole("heading", {name: /Airdrop to stakers/})).toBeVisible();
    await expect(page.getByText("rewards · distribute denom rewards")).toBeVisible();
    const token = page.getByRole("region", {name: "Staked token"});
    await expect(token).toHaveAttribute("data-state", "done");
    await expect(token).toContainText("NOAD stakers");

    const prize = page.getByRole("region", {name: "Prize & amount"});
    await expect(prize).toHaveAttribute("data-state", "active");
    await prize.getByRole("combobox").click();
    await page.getByPlaceholder("Search by name or ticker...").fill("VDL");
    await page.getByRole("option").filter({hasText: "VDL"}).first().click();
    await expect(prize.getByTestId("prize-slot-note")).toHaveText("No prize fee: NOAD already pays VDL.");
    await prize.getByLabel(/Amount/).fill("100");
    await expect(prize.getByTestId("airdrop-sentence")).toContainText("100 VDL is split right now between everyone staking NOAD (25 NOAD staked), pro rata.");
    await prize.getByRole("button", {name: "Continue"}).click();

    const review = page.getByRole("region", {name: "Review"});
    await expect(review).toHaveAttribute("data-state", "active");
    await expect(review.getByRole("region", {name: "Leaves your wallet"})).toContainText("100 VDL");
    await expect(review.getByRole("region", {name: "You get"})).toContainText("NOAD stakers can claim it right away");
    await expect(review).toContainText("An airdrop can't be undone");
    await expect(review.getByRole("button", {name: "Airdrop now"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet to airdrop.")).toBeVisible();
});

test("refuses a compounded reward nobody is staking", async ({page, network}) => {
    network.use("lcd", {
        ...DENOM_REWARD,
        body: {denom_reward: {...DENOM_REWARD.body.denom_reward, staked_amount: "0"}},
    });
    await page.goto(`/denom-reward/airdrop?denom=${NOADMIN}`);

    const token = page.getByRole("region", {name: "Staked token"});
    await expect(token).toHaveAttribute("data-state", "active");
    await expect(page.getByTestId("airdrop-blocker")).toContainText("Nobody is staking NOAD yet");
    await expect(token.getByRole("button", {name: "Continue"})).toBeDisabled();
});

test("a token nobody stakes can't be picked", async ({page, network}) => {
    network.use("lcd", {
        ...ALL_DENOM_REWARDS,
        body: {...ALL_DENOM_REWARDS.body, list: [{...ALL_DENOM_REWARDS.body.list[0], staked_amount: "0"}]},
    });
    await page.goto("/denom-reward/airdrop");

    const token = page.getByRole("region", {name: "Staked token"});
    await token.getByRole("textbox", {name: "Search tokens"}).fill("noadmin");
    const row = token.getByRole("radio").filter({hasText: "NOAD"}).first();
    await expect(row).toContainText("Nothing staked · airdrop waits");
    await expect(row).toBeDisabled();
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`/denom-reward/airdrop?denom=${NOADMIN}`);

    await expect(page.getByRole("region", {name: "You will pay"})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
