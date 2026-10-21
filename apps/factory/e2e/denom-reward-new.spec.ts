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
    await expect(page.getByText("rewards · denom reward")).toBeVisible();

    // The deep link answers step 1.
    const token = page.getByRole("region", {name: "Token", exact: true});
    await expect(token).toHaveAttribute("data-state", "done");
    await expect(token).toContainText("Make TUSDC stakable");

    const prize = page.getByRole("region", {name: "First daily prize"});
    await expect(prize).toHaveAttribute("data-state", "active");
    await expect(prize.getByText("Stakers earn nothing until someone adds a prize. You can add one right after.")).toBeVisible();
    await prize.getByRole("button", {name: "Skip"}).click();
    await expect(prize).toContainText("No prize yet");

    const review = page.getByRole("region", {name: "Review"});
    await expect(review).toHaveAttribute("data-state", "active");
    await expect(review.getByRole("region", {name: "Leaves your wallet"})).toContainText("Compounded reward fee");
    await expect(review.getByRole("region", {name: "Leaves your wallet"})).toContainText("25,000 TBZE");
    await expect(review.getByRole("region", {name: "You get"})).toContainText("TUSDC becomes stakable for everyone");
    await expect(review).toContainText("There is one compounded reward per token. It can't be removed");
    await expect(review.getByRole("button", {name: "Make TUSDC stakable"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet to make it stakable.")).toBeVisible();
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
    await prize.getByLabel(/Prize per day/).fill("100");
    await prize.getByLabel(/Payout days/).fill("30");
    await expect(prize.getByTestId("escrow-amount")).toHaveText("3,000 VDL");
    await prize.getByRole("button", {name: "Continue"}).click();
    await expect(prize).toContainText("100 VDL a day for 30 days");

    const leaves = page.getByRole("region", {name: "Review"}).getByRole("region", {name: "Leaves your wallet"});
    await expect(leaves).toContainText("Daily prize fee");
    await expect(leaves).toContainText("New prize fee");
    await expect(leaves).toContainText("75,000 TBZE");
    await expect(leaves).toContainText("3,000 VDL");
});

test("picking a token that is already stakable tips to add a prize instead", async ({page}) => {
    await page.goto("/denom-reward/new");

    const token = page.getByRole("region", {name: "Token", exact: true});
    await expect(token).toHaveAttribute("data-state", "active");
    await token.getByRole("textbox", {name: "Search tokens"}).fill("noadmin");
    const row = token.getByRole("radio").filter({hasText: "NOAD"}).first();
    await expect(row).toContainText("Already stakable");
    await row.click();

    await expect(token.getByTestId("already-stakable")).toHaveText("NOAD is already stakable. Add a prize to it instead.");
    await expect(token.getByRole("link", {name: "Add a daily prize"})).toHaveAttribute("href", `/denom-reward/schedule?denom=${encodeURIComponent(NOADMIN)}`);
    await expect(token.getByRole("link", {name: "Airdrop to stakers"})).toHaveAttribute("href", `/denom-reward/airdrop?denom=${encodeURIComponent(NOADMIN)}`);
    await expect(token.getByRole("button", {name: "Continue"})).toBeDisabled();
});
