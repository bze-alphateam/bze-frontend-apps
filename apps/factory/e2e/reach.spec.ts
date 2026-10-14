import {readFileSync} from "node:fs";
import {join} from "node:path";
import {expect, test} from "./support/mock-network";

// "Reach another community" (/reach, BFE-163) without a wallet, against the testnet fixtures: every
// holder reward (fixtures/lcd/rewards.all_denom_rewards.json, only noadmin, with 20 NOAD staked) and
// the noadmin denom reward and prizes. The filter case adds testusd with nothing staked through
// network.use.

const NOADMIN = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";
const TESTUSD = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/testusd";

const ALL = JSON.parse(readFileSync(join(__dirname, "fixtures", "lcd", "rewards.all_denom_rewards.json"), "utf8"));

test("lists the communities with stakers and asks to connect after picking one", async ({page}) => {
    await page.goto("/reach");

    await expect(page.getByRole("heading", {name: "Reach another community"})).toBeVisible();
    const options = page.getByTestId("community-option");
    await expect(options).toHaveCount(1);
    await expect(options.first()).toContainText("NOAD");
    await expect(options.first()).toContainText("NOAD staked");

    await options.first().click();
    await page.getByRole("region", {name: "Which community?"}).getByRole("button", {name: "Continue"}).click();
    await expect(page.getByRole("region", {name: "Which community?"})).toHaveAttribute("data-state", "done");
    await expect(page.getByRole("region", {name: "What do you give them?"})).toHaveAttribute("data-state", "active");
    await expect(page.getByRole("button", {name: "Send the gift"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet to send the gift.")).toBeVisible();
});

test("leaves out a holder reward nobody is staking", async ({page, network}) => {
    network.use("lcd", {
        ...ALL,
        body: {
            ...ALL.body,
            list: [...ALL.body.list, {staking_denom: TESTUSD, lock: 7, min_stake: "0", staked_amount: "0"}],
        },
    });
    await page.goto("/reach");

    await expect(page.getByTestId("community-option")).toHaveCount(1);
    await expect(page.getByRole("radio", {name: "TUSDC"})).toHaveCount(0);
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`/reach?community=${encodeURIComponent(NOADMIN)}`);

    await expect(page.getByRole("region", {name: "What do you give them?"})).toHaveAttribute("data-state", "active");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
