import {expect, test} from "./support/mock-network";
import {bzeWallets} from "./support/wallets";

// "Send to a list of wallets" (/multisend, BFE-152) without a wallet, against the testnet fixtures.
// `?denom=ubze` answers question 1 with the native TBZE.

const A = "bze13x5v3t9plqu8ql3h44ltx0ys59uzz43lt6p0tz";
const B = "bze1sx6ep2vtlzsdj73tseeq3ydahqyt0ey2gs3tg0";

test("reads a pasted list: ready wallets, a merged duplicate and a line to fix", async ({page}) => {
    await page.goto("/multisend?denom=ubze");

    await expect(page.getByRole("heading", {name: "Send to a list of wallets"})).toBeVisible();
    await expect(page.getByRole("region", {name: "What do you send?"})).toHaveAttribute("data-state", "done");
    const list = page.getByRole("region", {name: "Who gets it, and how much?"});
    await expect(list).toHaveAttribute("data-state", "active");

    await list.getByLabel(/Amount each/).fill("2");
    await list.getByLabel(/one per line/).fill(`${A}\nnot-a-wallet\n${A}\n${B}`);

    await expect(list.getByText("2 wallets ready")).toBeVisible();
    await expect(list.getByText("1 duplicates, merged into one")).toBeVisible();
    await expect(list.getByText("1 lines to fix, left out")).toBeVisible();
    await list.getByText("Show the lines to fix").click();
    await expect(list.getByText(/Line 2: not-a-wallet isn't a valid BeeZee address/)).toBeVisible();

    await list.getByRole("button", {name: "Continue"}).click();
    await expect(page.getByRole("region", {name: "What will happen"})).toContainText("4 TBZE goes to 2 wallets, each getting 2 TBZE.");
    const pay = page.getByRole("region", {name: "You will pay"});
    await expect(pay.getByText("Factory fee")).toBeVisible();
    await expect(pay.getByText("None", {exact: true})).toBeVisible();

    await expect(page.getByRole("button", {name: "Send to 2 wallets"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet to send.")).toBeVisible();
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/multisend?denom=ubze");

    const list = page.getByRole("region", {name: "Who gets it, and how much?"});
    await list.getByLabel(/one per line/).fill(`${A}\nosmo108cyg5m3hwnu496xv5mnwkx33lmdvs7e7lptjl`);
    await list.getByText("Show the lines to fix").click();
    await expect(page.getByRole("region", {name: "You will pay"})).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});

test("a long list is planned as transactions of 100 and fits a 390 px phone", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/multisend?denom=ubze");

    const list = page.getByRole("region", {name: "Who gets it, and how much?"});
    await list.getByLabel(/Amount each/).fill("1");
    await list.getByLabel(/one per line/).fill(bzeWallets(250).join("\n"));
    await expect(list.getByText("250 wallets ready")).toBeVisible();
    await list.getByRole("button", {name: "Continue"}).click();

    await expect(page.getByText(/It's sent in 3 transactions of up to 100 wallets each/)).toBeVisible();
    await expect(page.getByRole("button", {name: "Start sending (3 transactions)"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet to send.")).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
