import {expect, test} from "./support/mock-network";

// "Run a burning raffle" (/raffle/new, BFE-208) without a wallet, against the testnet fixtures.
// fixtures/lcd/burner.raffles.json has no raffle running, so `?denom=ubze` answers question 1
// with the native TBZE.

test("Grow a community offers Run a burning raffle", async ({page}) => {
    await page.goto("/create/grow");

    const card = page.getByRole("link", {name: /Run a burning raffle/});
    await expect(card).toContainText("Burner raffle");
    await expect(card).toContainText("No fee");
    await expect(card).toHaveAttribute("href", "/raffle/new");
});

test("asks six questions, shows the warnings, and asks to connect before signing", async ({page}) => {
    await page.goto("/raffle/new?denom=ubze");

    await expect(page.getByRole("heading", {name: "Run a burning raffle"})).toBeVisible();
    const token = page.getByRole("region", {name: "Which token?"});
    await expect(token).toHaveAttribute("data-state", "done");
    await expect(token).toContainText("Raffle TBZE");
    for (const title of [
        "How big is the prize pot?",
        "How long should it run?",
        "What does a ticket cost?",
        "How often does a ticket win?",
        "How much does a winner get?",
    ]) {
        await expect(page.getByRole("region", {name: title})).toBeVisible();
    }

    await expect(page.getByText("The pot leaves your wallet now and can't be taken back.")).toBeVisible();
    await expect(page.getByText("Once started, a raffle can't be stopped or changed.")).toBeVisible();
    await expect(page.getByText("Whatever is left in the pot when it ends is burned. Nothing comes back to you.")).toBeVisible();

    const pot = page.getByRole("region", {name: "How big is the prize pot?"});
    await pot.getByLabel(/Prize pot/).fill("1000");
    await pot.getByRole("button", {name: "Continue"}).click();
    const days = page.getByRole("region", {name: "How long should it run?"});
    await days.getByRole("button", {name: "14 days"}).click();
    await expect(days.getByText(/Ends around/)).toBeVisible();
    await days.getByRole("button", {name: "Continue"}).click();
    const ticket = page.getByRole("region", {name: "What does a ticket cost?"});
    await ticket.getByLabel(/Ticket price/).fill("10");
    await ticket.getByRole("button", {name: "Continue"}).click();
    const chance = page.getByRole("region", {name: "How often does a ticket win?"});
    await chance.getByRole("button", {name: "1 in 100"}).click();
    await chance.getByRole("button", {name: "Continue"}).click();
    const prize = page.getByRole("region", {name: "How much does a winner get?"});
    await prize.getByRole("button", {name: "25 %"}).click();
    await prize.getByRole("button", {name: "Continue"}).click();

    await expect(page.getByRole("region", {name: "What will happen"})).toContainText(
        "You put 1,000 TBZE in the pot now. For 14 days, anyone can buy a ticket for 10 TBZE.",
    );
    await expect(page.getByText("On average the pot grows as people play.")).toBeVisible();
    const pay = page.getByRole("region", {name: "You will pay"});
    await expect(pay.getByText("Factory fee")).toBeVisible();
    await expect(pay.getByText("None", {exact: true})).toBeVisible();

    await expect(page.getByRole("button", {name: "Start the raffle"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet to start the raffle.")).toBeVisible();
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/raffle/new?denom=ubze");

    await expect(page.getByRole("region", {name: "How big is the prize pot?"})).toHaveAttribute("data-state", "active");
    await expect(page.getByRole("region", {name: "You will pay"})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
