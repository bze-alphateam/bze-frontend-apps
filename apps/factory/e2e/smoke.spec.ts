import {expect, test} from "./support/mock-network";

// Smoke spec for the starting-point home and the Choose screens (BFE-260) and /tokens without a
// wallet, against the testnet fixtures in e2e/fixtures/.

test("the home starts from six starting points, two of them coming soon", async ({page}) => {
    await page.goto("/");

    await expect(page.getByRole("heading", {level: 1, name: "What are you building today?"})).toBeVisible();
    for (const id of ["token", "market", "rewards", "grow"]) {
        await expect(page.getByTestId(`start-${id}`)).toHaveAttribute("href", /\//);
    }
    for (const id of ["dao", "contest"]) {
        await expect(page.getByTestId(`start-${id}`)).toContainText("Coming soon");
        await expect(page.getByTestId(`start-${id}`).getByRole("link")).toHaveCount(0);
    }
    await expect(page.getByRole("region", {name: "Work on something that exists"})).toBeVisible();
    await expect(page.getByRole("link", {name: /Guides and strategies on docs\.getbze\.com/})).toHaveAttribute("href", "https://docs.getbze.com");
});

test("with no drafts the home has no Continue line, just the starting points", async ({page}) => {
    await page.goto("/");

    await expect(page.getByRole("heading", {level: 1, name: "What are you building today?"})).toBeVisible();
    await expect(page.getByRole("complementary", {name: "Continue where you left off"})).toHaveCount(0);
    await expect(page.getByRole("region", {name: "Starting points"})).toBeVisible();
    await expect(page.getByRole("region", {name: "How it works"})).toHaveCount(0);
});

test("home → Create a DEX market → Liquidity pool lands on the pool wizard", async ({page}) => {
    await page.goto("/");

    await page.getByTestId("start-market").click();
    await expect(page).toHaveURL(/\/create\/market$/);
    await expect(page.getByRole("heading", {level: 1, name: "What kind of market do you want to create?"})).toBeVisible();
    // Pools and markets pay the same tradebin fee: fixtures/lcd/tradebin.params.json (25,000 TBZE).
    await expect(page.getByRole("region", {name: "Liquidity pool"}).getByTestId("fee-line")).toHaveText("Creation fee 25,000 TBZE + network fee");

    await page.getByRole("link", {name: /Create liquidity pool/}).click();
    await expect(page).toHaveURL(/\/pool\/new$/);
});

test("the staking rewards and community Choose screens render", async ({page}) => {
    await page.goto("/create/rewards");
    await expect(page.getByRole("heading", {level: 1, name: "Which kind of reward?"})).toBeVisible();
    await expect(page.getByRole("region", {name: "Simple reward"}).getByTestId("fee-line")).toContainText("TBZE");
    await expect(page.getByRole("region", {name: "Compounded reward"}).getByTestId("fee-line")).toContainText("TBZE");
    await expect(page.getByText("Already created a reward?")).toHaveCount(0);

    await page.goto("/create/grow");
    await expect(page.getByRole("heading", {level: 1, name: "How do you want to grow?"})).toBeVisible();
    await expect(page.getByTestId("option-card")).toHaveCount(2);
    await expect(page.getByRole("link", {name: /^Airdrop$/})).toHaveAttribute("href", "/airdrop");
});

test("old URLs redirect: /manage to /tokens, /playbooks home", async ({page}) => {
    await page.goto("/manage");
    await expect(page).toHaveURL(/\/tokens$/);
    await expect(page.getByRole("heading", {level: 1, name: "Tokens"})).toBeVisible();

    await page.goto("/playbooks?id=launch");
    await expect(page).toHaveURL(/\/\?id=launch$/);
    await expect(page.getByRole("heading", {level: 1, name: "What are you building today?"})).toBeVisible();
});

test("the nav reads Create · Tokens · Rewards", async ({page}) => {
    await page.goto("/create/rewards");
    const nav = page.getByRole("navigation", {name: "Main"}).first();
    await expect(nav.getByRole("link", {name: "Create", exact: true})).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", {name: "Tokens", exact: true})).toHaveAttribute("href", "/tokens");
    await expect(nav.getByRole("link", {name: "Rewards", exact: true})).toHaveAttribute("href", "/rewards");
});

test("/tokens without a wallet lists every Factory token and no 'Created by you' group", async ({page}) => {
    await page.goto("/tokens");

    await expect(page.getByRole("heading", {level: 1, name: "Tokens"})).toBeVisible();
    await expect(page.getByRole("region", {name: "All tokens"}).getByTestId("token-row")).toHaveCount(4);
    await expect(page.getByRole("region", {name: "Created by you"})).toHaveCount(0);
});

test("the navbar's Apps menu lists the other BZE apps with their icons, Explorer on the testnet explorer", async ({page}) => {
    await page.goto("/");
    await page.getByRole("button", {name: "Apps"}).click();

    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem")).toHaveText(["Website", "DEX", "Staking", "Burner", "Communities", "Explorer"]);
    await expect(menu.getByTestId("app-icon")).toHaveCount(6);
    const explorer = menu.getByRole("menuitem", {name: "Explorer"});
    await expect(explorer).toHaveAttribute("href", "https://testnet-explorer.getbze.com");
    await expect(explorer).toHaveAttribute("target", "_blank");
});
