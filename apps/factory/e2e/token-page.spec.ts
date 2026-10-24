import {expect, test} from "./support/mock-network";

// The token page (/tokens/token, BFE-271) opens any Factory token, for any wallet. Without a wallet
// it shows what anyone can do and no admin action. The fixture token is testnet's noadmin (NOAD):
// its admin (fixtures/lcd/tokenfactory.denom_authority.noadmin.json), supply, metadata and brand kit,
// plus its compounded reward with two daily prizes and its NOAD/TUSDC pool.

const ISSUER = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";
const NOADMIN = encodeURIComponent(`${ISSUER}/noadmin`);
const MISSING_TOKEN = "factory%2Fbze1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq%2Futok";

test("a Factory token: header and the groups, with no admin action", async ({page}) => {
    await page.goto(`/tokens/token?denom=${NOADMIN}&tab=supply`);

    await expect(page.getByRole("heading", {name: "NoAdminToken"})).toBeVisible();
    const crumbs = page.getByRole("navigation", {name: "Breadcrumb"});
    await expect(crumbs.getByRole("link", {name: "Tokens"})).toHaveAttribute("href", "/tokens");
    await expect(crumbs).toContainText("NOAD");
    await expect(page.getByTestId("token-stats")).toContainText("25 NOAD");
    // No setup summary any more.
    await expect(page.getByTestId("setup-chips")).toHaveCount(0);
    await expect(page.getByText(/Getting there|All set/)).toHaveCount(0);

    const supply = page.getByRole("region", {name: "Supply"});
    await expect(supply.getByTestId("burn-item").getByRole("link", {name: /Burner/}))
        .toHaveAttribute("href", new RegExp(`/coin\\?coin=${NOADMIN}$`));
    await expect(supply.getByRole("link", {name: "Start raffle"})).toBeVisible();

    const trading = page.getByRole("region", {name: "Trading"});
    await expect(trading.getByText("NOAD/TUSDC pool")).toBeVisible();
    await expect(trading.getByTestId("pair-item")).toContainText("Create DEX market");
    await expect(trading.getByRole("link", {name: "Create"})).toHaveAttribute("href", new RegExp(`^/create/market\\?base=${NOADMIN}&return=`));

    const details = page.getByRole("region", {name: "Details and look"});
    await expect(details.getByTestId("metadata-item").getByRole("button", {name: "View"})).toBeVisible();
    await expect(details.getByTestId("brand-kit-item").getByRole("button", {name: "View"})).toBeVisible();

    const rewards = page.getByRole("region", {name: "Rewards on NOAD"});
    await expect(rewards.getByTestId("daily-prize-line")).toHaveCount(2);
    const actions = rewards.getByTestId("compounded-actions");
    await expect(actions.getByRole("link", {name: "Airdrop", exact: true})).toHaveCount(0);
    const dexDetails = actions.getByRole("link", {name: /DEX/});
    await expect(dexDetails).toHaveAttribute("href", new RegExp(`/staking/details\\?id=compounded%3A${NOADMIN}$`));
    await expect(dexDetails).toHaveAttribute("target", "_blank");
    await expect(dexDetails).toHaveAttribute("rel", "noopener noreferrer");
    await expect(rewards.getByTestId("new-simple-reward")).toHaveCount(0);

    // Admin actions wait for a wallet that is the admin; ?tab= is ignored.
    await expect(page.getByRole("button", {name: "Mint"})).toHaveCount(0);
    await expect(page.getByRole("tablist")).toHaveCount(0);

    // Permissions without a wallet: the status line only (BFE-273).
    const permissions = page.getByTestId("permissions-section");
    await expect(permissions.getByTestId("permissions-status")).toHaveText(/^Admin: bze1z3/);
    await expect(permissions.getByTestId("transfer-admin-item")).toHaveCount(0);
    await expect(permissions.getByTestId("renounce-admin-item")).toHaveCount(0);
    await expect(permissions.getByRole("button")).toHaveCount(0);
    await expect(page.getByText(/How many to burn/)).toHaveCount(0);
});

test("an unknown denom gets the not-found state", async ({page}) => {
    await page.goto(`/tokens/token?denom=${MISSING_TOKEN}`);

    await expect(page.getByText("We couldn't find this token.")).toBeVisible();
    await expect(page.getByTestId("token-page-state").getByRole("link", {name: /All tokens/})).toHaveAttribute("href", "/tokens");
});

test("a token not made with Factory points to its DEX page", async ({page}) => {
    await page.goto("/tokens/token?denom=ubze");

    await expect(page.getByText("Only tokens made with Factory have a page here.")).toBeVisible();
    await expect(page.getByTestId("token-page-state").getByRole("link", {name: /DEX/})).toHaveAttribute("href", /\/assets\/details\?denom=ubze$/);
});
