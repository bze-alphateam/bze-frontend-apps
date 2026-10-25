import {expect, test} from "./support/mock-network";
import {bzeWallets} from "./support/wallets";

// Airdrop coins to a list of wallets (/airdrop?to=list, formerly /multisend, BFE-266): the Who ·
// Token · List · Review wizard without a wallet, against the testnet fixtures. `?denom=ubze` answers
// the Token step with the native TBZE.

const A = "bze13x5v3t9plqu8ql3h44ltx0ys59uzz43lt6p0tz";
const B = "bze1sx6ep2vtlzsdj73tseeq3ydahqyt0ey2gs3tg0";

test("checks a pasted list with an invalid and a duplicate line, then reaches Review", async ({page}) => {
    // The old route redirects, its query kept.
    await page.goto("/multisend?denom=ubze");
    await expect(page).toHaveURL(/\/airdrop\?.*to=list/);

    await expect(page.getByRole("heading", {level: 1, name: "Airdrop tokens"})).toBeVisible();
    await expect(page.getByRole("region", {name: "Who", exact: true})).toContainText("A list of wallets");
    await expect(page.getByRole("region", {name: "Token", exact: true})).toHaveAttribute("data-state", "done");
    const list = page.getByRole("region", {name: "List", exact: true});
    await expect(list).toHaveAttribute("data-state", "active");
    await expect(list.getByText("Who gets it?")).toBeVisible();

    await list.getByLabel(/Amount each/).fill("2");
    await list.getByLabel(/one per line/).fill(`${A}\nnot-a-wallet\n${A}\n${B}`);

    const check = list.getByRole("region", {name: "List check"});
    await expect(check.getByText("2 wallets ready")).toBeVisible();
    await expect(check.getByText("Total 4 TBZE")).toBeVisible();
    await expect(check.getByText("1 duplicates, merged into one")).toBeVisible();
    await expect(check.getByText("1 lines to fix, left out")).toBeVisible();
    await expect(check.getByText(/Line 2: not-a-wallet isn't a valid BeeZee address/)).toBeVisible();

    await list.getByRole("button", {name: "Review"}).click();
    await expect(list).toContainText("2 wallets · 4 TBZE in total");
    await expect(page.getByRole("region", {name: "What will happen"})).toHaveCount(0);
    const pay = page.getByRole("region", {name: "You will pay"});
    await expect(pay.getByText("Sent to wallets")).toBeVisible();
    await expect(pay.getByText("Factory fee")).toHaveCount(0);

    const review = page.getByRole("region", {name: "Review", exact: true});
    await expect(review).toHaveAttribute("data-state", "active");
    await expect(review.getByRole("region", {name: "You get"})).toContainText("2 wallets receive TBZE");
    await expect(review.getByRole("region", {name: "Permanent"})).toContainText("Sent tokens can't be taken back");
    await expect(review.getByRole("button", {name: "Airdrop to 2 wallets"})).toBeDisabled();
    await expect(review.getByText("Connect your wallet.")).toBeVisible();
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/airdrop?to=list&denom=ubze");

    const list = page.getByRole("region", {name: "List", exact: true});
    await list.getByLabel(/one per line/).fill(`${A}\nosmo108cyg5m3hwnu496xv5mnwkx33lmdvs7e7lptjl`);
    await expect(list.getByText(/Line 2: osmo108cyg5m3hwnu496xv5mnwkx33lmdvs7e7lptjl/)).toBeVisible();
    await expect(page.getByRole("region", {name: "You will pay"})).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});

test("a long list is planned as transactions of 100 on Review and fits a 390 px phone", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/airdrop?to=list&denom=ubze");

    const list = page.getByRole("region", {name: "List", exact: true});
    await list.getByLabel(/Amount each/).fill("1");
    await list.getByLabel(/one per line/).fill(bzeWallets(250).join("\n"));
    await expect(list.getByText("250 wallets ready")).toBeVisible();
    await list.getByRole("button", {name: "Review"}).click();

    const review = page.getByRole("region", {name: "Review", exact: true});
    await expect(review.getByTestId("batch-note")).toHaveText("3 transactions · one approval each");
    await expect(review.getByText(/We send it in/)).toHaveCount(0);
    await expect(review.getByRole("button", {name: "Airdrop to 250 wallets"})).toBeDisabled();
    await expect(review.getByText("Connect your wallet.")).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
