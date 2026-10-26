import {readFileSync} from "node:fs";
import {join} from "node:path";
import {expect, test} from "./support/mock-network";

// "Create a compounded reward" (/denom-reward/new, BFE-265) without a wallet, against the testnet
// fixtures. testusd (TUSDC) has no compounded reward (the chain answers 404, given here with
// network.use); noadmin (NOAD) has one, so it is "already stakable". Every rewards fee is 25,000 TBZE
// (fixtures/lcd/rewards.params.json).

const ISSUER = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";
const TESTUSD = `${ISSUER}/testusd`;
const NOADMIN = `${ISSUER}/noadmin`;

const DENOM_REWARD = JSON.parse(readFileSync(join(__dirname, "fixtures", "lcd", "rewards.denom_reward.noadmin.json"), "utf8"));
const NO_DENOM_REWARD = {
    ...DENOM_REWARD,
    query: {denom: TESTUSD},
    status: 404,
    body: {code: 5, message: "denom reward not found", details: []},
};

test("walks from the preselected token to Review without a prize, with the fee and the connect message", async ({page, network}) => {
    network.use("lcd", NO_DENOM_REWARD);
    await page.goto(`/denom-reward/new?denom=${encodeURIComponent(TESTUSD)}`);

    await expect(page.getByRole("heading", {name: /Create a compounded reward/})).toBeVisible();
    await expect(page.getByText("rewards · denom reward", {exact: true})).toHaveCount(0);

    // The deep link answers step 1.
    const token = page.getByRole("region", {name: "Stake", exact: true});
    await expect(token).toHaveAttribute("data-state", "done");
    await expect(token).toContainText("Make TUSDC stakable");

    const prize = page.getByRole("region", {name: "First daily prize"});
    await expect(prize).toHaveAttribute("data-state", "active");
    await expect(prize.getByText("Stakers earn nothing until someone adds a prize. You can add one right after.")).toHaveCount(0);
    await expect(prize.getByRole("button", {name: "Skip"})).toHaveCount(0);
    await prize.getByRole("button", {name: "Continue"}).click();
    await expect(prize).toContainText("No prize yet");

    const review = page.getByRole("region", {name: "Review"});
    await expect(review).toHaveAttribute("data-state", "active");
    await expect(review.getByRole("region", {name: "You pay"})).toContainText("Compounded reward fee");
    await expect(review.getByRole("region", {name: "You pay"})).toContainText("25,000 TBZE");
    await expect(review.getByRole("region", {name: "You get"})).toContainText("TUSDC becomes stakable");
    await expect(review.getByRole("region", {name: "Permanent"})).toContainText("This action can't be undone");
    await expect(review.getByRole("button", {name: "Make TUSDC stakable"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet.")).toBeVisible();
});

test("with a first daily prize, Review lists the prize fees and the locked prize", async ({page, network}) => {
    network.use("lcd", NO_DENOM_REWARD);
    await page.goto(`/denom-reward/new?denom=${encodeURIComponent(TESTUSD)}`);

    const prize = page.getByRole("region", {name: "First daily prize"});
    await prize.getByRole("button", {name: "Add a daily prize"}).click();
    // The prize token: VDL, through the picker's search.
    await prize.getByRole("combobox").click();
    await page.getByPlaceholder("Search by name or ticker...").fill("VDL");
    await page.getByRole("option").filter({hasText: "VDL"}).first().click();
    await prize.getByLabel(/Daily reward/).fill("100");
    await prize.getByLabel("Days", {exact: true}).fill("30");
    await expect(prize.getByTestId("escrow-line")).toHaveCount(0);
    await prize.getByRole("button", {name: "Continue"}).click();
    await expect(prize).toContainText("100 VDL/day × 30 days");

    const leaves = page.getByRole("region", {name: "Review"}).getByRole("region", {name: "You pay"});
    await expect(leaves).toContainText("Daily prize fee");
    await expect(leaves).toContainText("New prize fee");
    await expect(page.getByTestId("pay-total")).toContainText("75,000");
    await expect(leaves).toContainText("Rewards");
    await expect(leaves).toContainText("3,000 VDL");
    await expect(page.getByRole("region", {name: "Review"})).toContainText("This action can't be undone");
});

test("picking a token that is already stakable continues to adding a prize to it", async ({page}) => {
    await page.goto("/denom-reward/new");

    const token = page.getByRole("region", {name: "Stake", exact: true});
    await expect(token).toHaveAttribute("data-state", "active");
    await token.getByRole("combobox").click();
    await page.getByPlaceholder("Search by name or ticker...").fill("noadmin");
    await page.getByRole("option").filter({hasText: "NOAD"}).first().click();

    await expect(token.getByTestId("already-stakable")).toContainText("NOAD is already stakable.");
    await token.getByRole("button", {name: "Continue to add a prize"}).click();
    await expect(page).toHaveURL(new RegExp(`/denom-reward/schedule\\?denom=${encodeURIComponent(NOADMIN)}$`));
    await expect(page.getByRole("heading", {name: /Add a daily prize/})).toBeVisible();
    await expect(page.getByRole("region", {name: "Prize", exact: true})).toHaveAttribute("data-state", "active");
});
