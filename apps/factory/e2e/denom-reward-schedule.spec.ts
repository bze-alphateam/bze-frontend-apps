import {expect, test} from "./support/mock-network";

// "Give a little every day" (/denom-reward/schedule, BFE-151) without a wallet, against the testnet
// fixtures: the noadmin denom reward (fixtures/lcd/rewards.denom_reward.noadmin.json), its schedules
// and prizes, and the daily prize fee from fixtures/lcd/rewards.params.json (25,000 TBZE).

const NOADMIN = encodeURIComponent("factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin");

test("shows the three questions, the daily prize fee and the connect message", async ({page}) => {
    await page.goto(`/denom-reward/schedule?denom=${NOADMIN}`);

    await expect(page.getByRole("heading", {name: /Give a little every day/})).toBeVisible();
    await expect(page.getByText("rewards · denom reward schedule")).toBeVisible();

    await expect(page.getByRole("region", {name: "What do you give?"})).toHaveAttribute("data-state", "active");
    await expect(page.getByRole("region", {name: "How much a day?"})).toHaveAttribute("data-state", "todo");
    await expect(page.getByRole("region", {name: "For how many days?"})).toHaveAttribute("data-state", "todo");

    const pay = page.getByRole("region", {name: "You will pay"});
    await expect(pay.getByText("Daily prize fee")).toBeVisible();
    await expect(pay.getByText("25,000 TBZE", {exact: true})).toBeVisible();

    await expect(page.getByRole("button", {name: "Start the daily prize"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet to fund this schedule.")).toBeVisible();
});

test("explains a schedule that no longer runs", async ({page}) => {
    await page.goto(`/denom-reward/schedule?denom=${NOADMIN}&schedule=999`);

    await expect(page.getByText("Schedule not found")).toBeVisible();
    await expect(page.getByRole("button", {name: /Back to the token/})).toBeVisible();
});

test("extends a running schedule without a fee", async ({page}) => {
    await page.goto(`/denom-reward/schedule?denom=${NOADMIN}&schedule=000000000000`);

    await expect(page.getByRole("heading", {name: /Extend a daily prize/})).toBeVisible();
    await expect(page.getByText(/Runs 200 days, 2 paid/)).toBeVisible();
    await expect(page.getByRole("region", {name: "How many more days?"})).toHaveAttribute("data-state", "active");
    await expect(page.getByRole("region", {name: "You will pay"}).getByText("None", {exact: true})).toBeVisible();
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`/denom-reward/schedule?denom=${NOADMIN}`);

    await expect(page.getByRole("region", {name: "You will pay"})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
