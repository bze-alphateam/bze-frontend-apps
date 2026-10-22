import {expect, test} from "./support/mock-network";

// "Run a burning raffle" (/raffle/new, BFE-270) without a wallet, against the testnet fixtures.
// fixtures/lcd/burner.raffles.json has no raffle running, so `?denom=ubze` answers the Token step
// with the native TBZE.

test("Grow a community offers Run a burning raffle", async ({page}) => {
    await page.goto("/create/grow");

    const card = page.getByRole("link", {name: /Run a burning raffle/});
    await expect(card).toContainText("Burner raffle");
    await expect(card).toContainText("No fee");
    await expect(card).toHaveAttribute("href", "/raffle/new");
});

test("Token, Prize pot and How it plays, then Review with the connect message", async ({page}) => {
    await page.goto("/raffle/new?denom=ubze");

    await expect(page.getByRole("heading", {name: "Run a burning raffle"})).toBeVisible();
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
    await expect(play.getByText(/Ends around/)).toBeVisible();
    await play.getByLabel(/Ticket price/).fill("10");
    await play.getByRole("button", {name: "1 in 100"}).click();
    await play.getByRole("button", {name: "25 %"}).click();
    await expect(play.getByTestId("raffle-sentence")).toHaveText(
        "For 14 days, anyone can pay 10 TBZE for a ticket. Each ticket has a 1 in 100 chance to win 25 % of the pot.",
    );
    await play.getByRole("button", {name: "Continue"}).click();
    await expect(play).toContainText("14 days · 10 TBZE a ticket · 1 in 100 · winner gets 25 %");

    await expect(page.getByText("On average the pot grows as people play.")).toBeVisible();
    const review = page.getByRole("region", {name: "Review"});
    await expect(review).toHaveAttribute("data-state", "active");
    await expect(review.getByRole("region", {name: "Leaves your wallet"})).toContainText("1,000 TBZE");
    await expect(review.getByRole("region", {name: "You get"})).toContainText("A raffle on Burner");
    await expect(review.getByRole("region", {name: "Permanent"})).toContainText("What's left in the pot at the end is burned");
    await expect(review.getByText("Once started, a raffle can't be stopped or changed.")).toBeVisible();
    await expect(review.getByRole("button", {name: "Start raffle"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet to start the raffle.")).toBeVisible();
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/raffle/new?denom=ubze");

    await expect(page.getByRole("region", {name: "Prize pot"})).toHaveAttribute("data-state", "active");
    await expect(page.getByRole("region", {name: "You will pay"})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
