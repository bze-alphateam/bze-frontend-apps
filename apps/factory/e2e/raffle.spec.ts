import {expect, test} from "./support/mock-network";

// "Start a burning raffle" (/raffle/new, BFE-270) without a wallet, against the testnet fixtures.
// fixtures/lcd/burner.raffles.json has no raffle running, so `?denom=ubze` answers the Token step
// with the native TBZE.

test("Grow a community offers a burning raffle", async ({page}) => {
    await page.goto("/create/grow");

    const card = page.getByRole("region", {name: "Burning raffle"});
    await expect(card.getByRole("link", {name: /Start raffle/})).toHaveAttribute("href", "/raffle/new");
});

test("Token, Prize pot and How it plays, then Review with the connect message", async ({page}) => {
    await page.goto("/raffle/new?denom=ubze");

    await expect(page.getByRole("heading", {name: "Start a burning raffle"})).toBeVisible();
    const token = page.getByRole("region", {name: "Token", exact: true});
    await expect(token).toHaveAttribute("data-state", "done");
    await expect(token).toContainText("TBZE");

    const pot = page.getByRole("region", {name: "Prize pot"});
    await expect(pot).toHaveAttribute("data-state", "active");
    await pot.getByLabel(/Prize pot/).fill("1000");
    await pot.getByRole("button", {name: "Continue"}).click();
    await expect(pot).toContainText("1,000 TBZE in the pot");

    const play = page.getByRole("region", {name: "How it plays"});
    await play.getByRole("button", {name: "14 days"}).click();
    await expect(play.getByTestId("raffle-end")).toContainText("End date");
    await expect(play.getByText(/Ends around/)).toHaveCount(0);
    await play.getByLabel(/Ticket price/).fill("10");
    await play.getByRole("button", {name: "1 in 100"}).click();
    await play.getByRole("button", {name: "25%"}).click();
    await expect(play.getByTestId("raffle-sentence")).toHaveCount(0);
    await play.getByRole("button", {name: "Continue"}).click();
    await expect(play).toContainText("14 days · 10 TBZE a ticket · 1 in 100 · winner gets 25%");

    await expect(page.getByRole("region", {name: "What will happen"})).toHaveCount(0);
    const review = page.getByRole("region", {name: "Review"});
    await expect(review).toHaveAttribute("data-state", "active");
    await expect(review.getByRole("region", {name: "Leaves your wallet"})).toContainText("1,000 TBZE");
    await expect(review.getByRole("region", {name: "You get"})).toContainText("A raffle on Burner");
    await expect(review.getByRole("region", {name: "Permanent"})).toContainText("What's left in the pot at the end is burned");
    await expect(review).toContainText("Grows on average");
    await expect(review.getByRole("region", {name: "Permanent"})).toContainText("Raffle settings can't change once started");
    await expect(review.getByText("Once started, a raffle can't be stopped or changed.")).toHaveCount(0);
    await expect(review.getByRole("button", {name: "Start raffle"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet.")).toBeVisible();
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/raffle/new?denom=ubze");

    await expect(page.getByRole("region", {name: "Prize pot"})).toHaveAttribute("data-state", "active");
    await expect(page.getByRole("region", {name: "You will pay"})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
