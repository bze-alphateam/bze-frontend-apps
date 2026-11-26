import {expect, test} from "./support/mock-network";

// The home page against the recorded testnet fixtures (chain params) and the hand-written
// Scan answers in e2e/fixtures/scan/ (the filters and routes of BFE-368 are not deployed on
// testnet yet, so those answers follow the ticket, not a recording). Four DAOs:
//   4 Stakers club (stake, 2 open proposals)   3 Treasury council (static list)
//   2 Founders (static list, self-owned)       1 Beekeepers (stake)

test("lists the DAOs with their type, owner and open proposals, and links each to its page", async ({page}) => {
    await page.goto("/");

    const cards = page.getByTestId("dao-card");
    await expect(cards).toHaveCount(3);
    await expect(cards.first()).toContainText("Stakers club");
    await expect(cards.first().getByTestId("dao-kind")).toHaveText("Stake");
    await expect(cards.first().getByTestId("dao-open")).toHaveText("2 open proposals");
    await expect(cards.first()).toHaveAttribute("href", "/dao/4");
    await expect(cards.nth(2).getByTestId("dao-owner")).toHaveText("Self-owned");
    await expect(cards.nth(1).getByTestId("dao-owner")).toHaveText("Admin-run");
});

test("Load more reads the next page", async ({page}) => {
    await page.goto("/");
    await expect(page.getByTestId("dao-card")).toHaveCount(3);

    await page.getByRole("button", {name: "Load more"}).click();
    await expect(page.getByTestId("dao-card")).toHaveCount(4);
    await expect(page.getByTestId("dao-card").nth(3)).toContainText("Beekeepers");
    await expect(page.getByRole("button", {name: "Load more"})).toHaveCount(0);
});

test("the type filter asks Scan for that type", async ({page}) => {
    await page.goto("/");
    await expect(page.getByTestId("dao-card")).toHaveCount(3);

    await page.getByRole("tab", {name: "Stake"}).click();
    await expect(page.getByTestId("dao-card")).toHaveCount(2);
    await expect(page.getByTestId("dao-kind")).toHaveText(["Stake", "Stake"]);
});

test("the name search asks Scan for the name", async ({page}) => {
    await page.goto("/");
    await expect(page.getByTestId("dao-card")).toHaveCount(3);

    await page.getByLabel("Search DAOs by name").fill("club");
    await expect(page.getByTestId("dao-card")).toHaveCount(1);
    await expect(page.getByTestId("dao-card")).toContainText("Stakers club");
});

test("lists the open proposals, soonest end first, each linking to its page", async ({page}) => {
    await page.goto("/");

    const feed = page.getByTestId("open-proposals").getByTestId("open-proposal");
    await expect(feed).toHaveCount(2);
    await expect(feed.first()).toContainText("Fund the hive festival");
    await expect(feed.first()).toContainText("Stakers club");
    await expect(feed.first()).toHaveAttribute("href", "/proposal/9");
});

test("shows what a DAO is and the creation fee from the chain's params", async ({page}) => {
    await page.goto("/");

    await expect(page.getByTestId("dao-explainer")).toContainText("What is a DAO on BeeZee?");
    // 50000000000 ubze at 6 decimals
    await expect(page.getByTestId("dao-creation-fee")).toContainText("Creating a DAO costs 50,000");
    await expect(page.getByRole("link", {name: "Create a DAO"})).toHaveAttribute("href", "/create");
});

test("the Create route says it is coming soon, and a proposal opens", async ({page}) => {
    await page.goto("/create");
    await expect(page.getByText("Creating a DAO is coming soon")).toBeVisible();

    await page.goto("/proposal/9");
    await expect(page.getByTestId("proposal-number")).toHaveText("Proposal #9");
});

test("the navbar lists DAOs and Create, and the Apps menu lists the other apps without DAO itself", async ({page}) => {
    await page.goto("/");
    const header = page.getByTestId("app-header");
    await expect(header.getByRole("link", {name: "DAOs"}).filter({visible: true})).toHaveCount(1);
    await expect(header.getByRole("link", {name: "Create"}).filter({visible: true})).toHaveCount(1);

    await page.getByRole("button", {name: "Apps"}).click();
    await expect(page.getByRole("menu").getByRole("menuitem")).toHaveText(["Website", "DEX", "Staking", "Burner", "Factory", "Communities", "Explorer"]);
});
