import {expect, test} from "./support/mock-network";

// Smoke spec for today's hub and /manage, against the testnet fixtures in e2e/fixtures/.
// The redesign tickets of BFE-142 rewrite these screens and this spec with them.

test("the hub shows the creation cards with their live fee", async ({page}) => {
    await page.goto("/");

    await expect(page.getByText("What do you want to create?")).toBeVisible();

    // The card's title, description and fee line share one stack. The fee comes from
    // fixtures/lcd/tokenfactory.params.json (create_denom_fee, 25,000 BZE on testnet).
    const tokenCard = page.getByText("Create Token", {exact: true}).locator("..");
    await expect(tokenCard).toBeVisible();
    await expect(tokenCard.getByText(/^Creation fee: \S+ BZE$/)).toBeVisible();
});

test("/manage without a wallet shows the empty state", async ({page}) => {
    await page.goto("/manage");

    await expect(page.getByText("My Creations")).toBeVisible();
    await expect(page.getByText("No tokens yet")).toBeVisible();
    await expect(page.getByRole("button", {name: "Create your first token"})).toBeVisible();
});
