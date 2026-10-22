import {readFileSync} from "node:fs";
import {join} from "node:path";
import {expect, test} from "./support/mock-network";

// "Reach another community" (/reach, BFE-270) without a wallet, against the testnet fixtures: every
// compounded reward (fixtures/lcd/rewards.all_denom_rewards.json, only noadmin) and the noadmin
// denom reward (25 NOAD staked) and prizes (NOAD and VDL). The disabled-row case answers with
// nothing staked through network.use.

const NOADMIN = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin";

const ALL = JSON.parse(readFileSync(join(__dirname, "fixtures", "lcd", "rewards.all_denom_rewards.json"), "utf8"));

test("Community, Gift and How, then Review with the connect message", async ({page}) => {
    await page.goto("/reach");

    await expect(page.getByRole("heading", {name: "Reach another community"})).toBeVisible();
    const community = page.getByRole("region", {name: "Community", exact: true});
    await community.getByRole("textbox", {name: "Search tokens"}).fill("noadmin");
    await community.getByRole("radio").filter({hasText: "NOAD"}).first().click();
    await community.getByRole("button", {name: "Continue"}).click();
    await expect(community).toHaveAttribute("data-state", "done");
    await expect(community).toContainText("NOAD stakers · 25 staked");

    const gift = page.getByRole("region", {name: "Gift", exact: true});
    await expect(gift).toHaveAttribute("data-state", "active");
    await gift.getByRole("combobox").click();
    await page.getByPlaceholder("Search by name or ticker...").fill("VDL");
    await page.getByRole("option").filter({hasText: "VDL"}).first().click();
    await expect(gift.getByTestId("prize-slot-note")).toHaveText("No prize fee: NOAD already pays VDL.");
    await gift.getByLabel(/Amount/).fill("100");
    await gift.getByRole("button", {name: "Continue"}).click();

    const how = page.getByRole("region", {name: "How", exact: true});
    await expect(how.getByTestId("reach-sentence")).toHaveText("100 VDL is split right now between everyone staking NOAD, by how much each stakes.");
    await how.getByRole("button", {name: "Continue"}).click();

    const review = page.getByRole("region", {name: "Review"});
    await expect(review).toHaveAttribute("data-state", "active");
    await expect(review.getByRole("region", {name: "Leaves your wallet"})).toContainText("100 VDL");
    await expect(review.getByRole("region", {name: "You get"})).toContainText("NOAD stakers receive VDL");
    await expect(review).toContainText("Gifts can't be taken back");
    await expect(review).toContainText("This adds a prize to NOAD's compounded reward. It doesn't make you its owner.");
    await expect(review.getByRole("button", {name: "Send gift"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet to send the gift.")).toBeVisible();
});

test("a community nobody stakes can't be picked", async ({page, network}) => {
    network.use("lcd", {
        ...ALL,
        body: {...ALL.body, list: [{...ALL.body.list[0], staked_amount: "0"}]},
    });
    await page.goto("/reach");

    const community = page.getByRole("region", {name: "Community", exact: true});
    await community.getByRole("textbox", {name: "Search tokens"}).fill("noadmin");
    const row = community.getByRole("radio").filter({hasText: "NOAD"}).first();
    await expect(row).toContainText("Nothing staked · airdrop waits");
    await expect(row).toBeDisabled();
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`/reach?community=${encodeURIComponent(NOADMIN)}`);

    await expect(page.getByRole("region", {name: "Gift", exact: true})).toHaveAttribute("data-state", "active");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
