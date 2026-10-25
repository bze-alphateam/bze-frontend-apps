import {readFileSync} from "node:fs";
import {join} from "node:path";
import {expect, test} from "./support/mock-network";

// Airdrop tokens (/airdrop) to stakers and LP providers, without a wallet, against the testnet
// fixtures: the noadmin compounded reward (fixtures/lcd/rewards.denom_reward.noadmin.json, 25 NOAD
// staked, prizes NOAD and VDL) and the one simple reward, #000000000000 (stake VDL, paid in VDL,
// finished, 37 VDL staked; VDL has no compounded reward). The list flow is in airdrop-list.spec.ts.

const NOADMIN = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
const DENOM_REWARD = JSON.parse(readFileSync(join(__dirname, "fixtures", "lcd", "rewards.denom_reward.noadmin.json"), "utf8"));

test.beforeEach(async ({page}) => {
    await page.clock.setFixedTime(new Date(2026, 9, 20, 12));
});

test("asks who gets the tokens first, and keeps the answer in the URL", async ({page}) => {
    await page.goto("/airdrop");

    await expect(page.getByRole("heading", {level: 1, name: "Airdrop tokens"})).toBeVisible();
    const who = page.getByRole("region", {name: "Who", exact: true});
    await expect(who.getByRole("radio")).toHaveCount(3);
    await who.getByRole("radio", {name: /Liquidity providers/}).click();
    await expect(page).toHaveURL(/\/airdrop\?to=lp$/);

    const token = page.getByRole("region", {name: "Stake", exact: true});
    await expect(token).toHaveAttribute("data-state", "active");
    await expect(token.getByText("Which LP shares?")).toBeVisible();
    await expect(token.getByTestId("picker-empty")).toHaveText("No LP shares are staked in a reward yet.");
});

test("through NOAD's compounded reward: any token, then Review with the connect message", async ({page}) => {
    await page.goto(`/airdrop?denom=${encodeURIComponent(NOADMIN)}`);

    await expect(page.getByRole("region", {name: "Who", exact: true})).toContainText("Stakers of a token");
    const token = page.getByRole("region", {name: "Stake", exact: true});
    await expect(token).toHaveAttribute("data-state", "done");
    await expect(token).toContainText("NOAD stakers");
    // NOAD has no simple reward: the compounded one answers the Reward step.
    await expect(page.getByRole("region", {name: "Reward", exact: true})).toContainText("Compounded reward · 25 NOAD staked");

    const amount = page.getByRole("region", {name: "Amount", exact: true});
    await expect(amount).toHaveAttribute("data-state", "active");
    await amount.getByRole("combobox").click();
    await page.getByPlaceholder("Search by name or ticker...").fill("VDL");
    await page.getByRole("option").filter({hasText: "VDL"}).first().click();
    await expect(amount.getByText("No prize fee: NOAD already pays VDL.")).toHaveCount(0);
    await amount.getByLabel("Amount (VDL)").fill("100");
    await expect(amount.getByTestId("airdrop-sentence")).toHaveCount(0);
    await amount.getByRole("button", {name: "Review", exact: true}).click();

    const review = page.getByRole("region", {name: "Review", exact: true});
    await expect(review).toHaveAttribute("data-state", "active");
    await expect(review.getByRole("region", {name: "Leaves your wallet"})).toContainText("100 VDL");
    await expect(review.getByRole("region", {name: "You get"})).toContainText("100 VDL to NOAD stakers");
    await expect(review).toContainText("An airdrop can't be undone");
    await expect(review.getByRole("button", {name: "Airdrop", exact: true})).toBeDisabled();
    await expect(page.getByText("Connect your wallet.")).toBeVisible();
});

test("refuses a token nobody is staking", async ({page, network}) => {
    network.use("lcd", {
        ...DENOM_REWARD,
        body: {denom_reward: {...DENOM_REWARD.body.denom_reward, staked_amount: "0"}},
    });
    await page.goto(`/airdrop?denom=${encodeURIComponent(NOADMIN)}`);

    const token = page.getByRole("region", {name: "Stake", exact: true});
    await expect(token).toHaveAttribute("data-state", "active");
    await expect(page.getByTestId("airdrop-blocker")).toHaveText("Nobody stakes NOAD yet.");
    await expect(token.getByRole("button", {name: "Continue"})).toBeDisabled();
});

test("the old Distribute link lands on the simple reward, in its own reward token", async ({page}) => {
    await page.goto("/reward/distribute?id=000000000000");
    await expect(page).toHaveURL(/\/airdrop\?id=000000000000/);

    await expect(page.getByRole("region", {name: "Stake", exact: true})).toContainText("VDL stakers");
    await expect(page.getByRole("region", {name: "Reward", exact: true})).toContainText("Simple reward #000000000000 · 37 VDL staked");
    const amount = page.getByRole("region", {name: "Amount", exact: true});
    await expect(amount).toHaveAttribute("data-state", "active");
    await expect(amount.getByText("Paid in VDL", {exact: true})).toBeVisible();
    await expect(amount.getByText("This reward has finished.")).toHaveCount(0);
    await amount.getByLabel("Amount (VDL)").fill("5");
    await expect(amount.getByTestId("airdrop-sentence")).toHaveCount(0);
    await amount.getByRole("button", {name: "Review", exact: true}).click();

    const review = page.getByRole("region", {name: "Review", exact: true});
    await expect(review.getByRole("button", {name: "Airdrop", exact: true})).toBeDisabled();
    await expect(page.getByText("Connect your wallet.")).toBeVisible();
});

test("the old airdrop and Reach links keep their token", async ({page}) => {
    await page.goto(`/denom-reward/airdrop?denom=${encodeURIComponent(NOADMIN)}`);
    await expect(page.getByRole("region", {name: "Stake", exact: true})).toContainText("NOAD stakers");

    await page.goto(`/reach?community=${encodeURIComponent(NOADMIN)}`);
    await expect(page).toHaveURL(/\/airdrop\?community=/);
    await expect(page.getByRole("region", {name: "Stake", exact: true})).toContainText("NOAD stakers");
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`/airdrop?denom=${encodeURIComponent(NOADMIN)}`);

    await expect(page.getByRole("region", {name: "You will pay"})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
