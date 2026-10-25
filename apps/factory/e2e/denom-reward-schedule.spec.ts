import {expect, test} from "./support/mock-network";

// The daily prize wizard (/denom-reward/schedule, BFE-268) without a wallet, against the testnet
// fixtures: the noadmin compounded reward (fixtures/lcd/rewards.denom_reward.noadmin.json), its
// schedules (000000000000 pays 10 VDL a day, 200 days, 2 paid) and prizes (NOAD and VDL), and the
// daily prize fee from fixtures/lcd/rewards.params.json (25,000 TBZE).

const NOADMIN = encodeURIComponent("factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin");

test("without a token, asks whose stakers first and lists what each stakes", async ({page}) => {
    await page.goto("/denom-reward/schedule");

    await expect(page.getByRole("heading", {name: /Add a daily prize/})).toBeVisible();
    const token = page.getByRole("region", {name: "Staked token"});
    await expect(token).toHaveAttribute("data-state", "active");
    await token.getByRole("textbox", {name: "Search tokens"}).fill("noadmin");
    await expect(token.getByRole("radio").filter({hasText: "NOAD"}).first()).toContainText("20 staked");
    await expect(token.getByRole("link", {name: "Make a token stakable"})).toHaveAttribute("href", "/denom-reward/new");
});

test("adds a daily prize for NOAD stakers and reaches Review with the fee and the connect message", async ({page}) => {
    await page.goto(`/denom-reward/schedule?denom=${NOADMIN}`);

    await expect(page.getByText("rewards · denom reward schedule")).toBeVisible();
    const token = page.getByRole("region", {name: "Staked token"});
    await expect(token).toHaveAttribute("data-state", "done");
    await expect(token).toContainText("NOAD stakers");

    const prize = page.getByRole("region", {name: "Prize", exact: true});
    await expect(prize).toHaveAttribute("data-state", "active");
    await prize.getByRole("combobox").click();
    await page.getByPlaceholder("Search by name or ticker...").fill("VDL");
    await page.getByRole("option").filter({hasText: "VDL"}).first().click();
    await expect(prize.getByTestId("prize-slot-note")).toHaveText("No prize fee: NOAD already pays VDL.");
    await prize.getByLabel(/Prize per day/).fill("100");
    await prize.getByLabel(/Payout days/).fill("30");
    await expect(prize.getByTestId("prize-sentence")).toContainText("Everyone staking NOAD shares 100 VDL a day for 30 days.");
    await expect(prize.getByTestId("escrow-amount")).toHaveText("3,000 VDL");
    await prize.getByRole("button", {name: "Continue"}).click();
    await expect(prize).toContainText("100 VDL a day for 30 days");

    const review = page.getByRole("region", {name: "Review"});
    await expect(review).toHaveAttribute("data-state", "active");
    const leaves = review.getByRole("region", {name: "Leaves your wallet"});
    await expect(leaves).toContainText("Daily prize fee");
    await expect(leaves).toContainText("25,000 TBZE");
    await expect(leaves).toContainText("3,000 VDL");
    await expect(review.getByRole("region", {name: "You get"})).toContainText("A daily prize for NOAD stakers");
    await expect(review).toContainText("Committed tokens are paid out to stakers; the daily amount can't change");
    await expect(review.getByRole("button", {name: "Start daily prize"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet to fund this daily prize.")).toBeVisible();
});

test("extends a running schedule without a fee", async ({page}) => {
    await page.goto(`/denom-reward/schedule?denom=${NOADMIN}&schedule=000000000000`);

    await expect(page.getByRole("heading", {name: /Extend a daily prize/})).toBeVisible();
    const schedule = page.getByRole("region", {name: "Daily prize", exact: true});
    await expect(schedule).toHaveAttribute("data-state", "done");
    await expect(schedule).toContainText("10 VDL a day for NOAD stakers · 198 days left");

    const days = page.getByRole("region", {name: "Extra days"});
    await expect(days).toHaveAttribute("data-state", "active");
    await expect(days).toContainText("Min 1 · Max");
    await days.getByLabel("Extra days").fill("10");
    await expect(days.getByTestId("extend-new-end")).toContainText("New end date");
    await days.getByRole("button", {name: "Review extension"}).click();

    const review = page.getByRole("region", {name: "Review"});
    await expect(review).toHaveAttribute("data-state", "active");
    const leaves = review.getByRole("region", {name: "Leaves your wallet"});
    await expect(leaves).toContainText("100 VDL");
    await expect(leaves.getByText("None", {exact: true})).toBeVisible();
    await expect(review.getByRole("button", {name: "Extend", exact: true})).toBeDisabled();
});

test("explains a schedule that no longer runs", async ({page}) => {
    await page.goto(`/denom-reward/schedule?denom=${NOADMIN}&schedule=999`);

    await expect(page.getByText("Schedule not found")).toBeVisible();
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`/denom-reward/schedule?denom=${NOADMIN}`);

    await expect(page.getByRole("region", {name: "You will pay"})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
