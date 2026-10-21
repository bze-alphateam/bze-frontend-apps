import {expect, test} from "./support/mock-network";

// "Create a token" (/token/new, BFE-261) without a wallet, against the testnet fixtures.
// The fee comes from fixtures/lcd/tokenfactory.params.json (create_denom_fee: 25,000 TBZE).
// Signing needs a wallet, so the walk stops at the disabled Create token button.

test("walks Details, Supply and Permissions to a Review with the creation fee", async ({page}) => {
    await page.goto("/token/new");

    await expect(page.getByRole("heading", {name: "Create a token"})).toBeVisible();
    await expect(page.getByText("tokenfactory · create denom")).toBeVisible();

    const details = page.getByRole("region", {name: "Details"});
    await expect(details).toHaveAttribute("data-state", "active");
    await expect(page.getByRole("region", {name: "Supply"})).toHaveAttribute("data-state", "todo");
    await expect(page.getByRole("region", {name: "Permissions"})).toHaveAttribute("data-state", "todo");
    await expect(page.getByRole("region", {name: "Review"})).toHaveAttribute("data-state", "todo");

    await details.getByPlaceholder("e.g. Honey", {exact: true}).fill("Honey");
    await details.getByPlaceholder("e.g. HONEY", {exact: true}).fill("honey");
    await expect(details.getByText("factory/<you>/uhoney")).toBeVisible();

    const outcome = page.getByRole("region", {name: "What will happen"});
    await expect(outcome.getByTestId("preview-name")).toHaveText("Honey");
    await expect(outcome.getByTestId("preview-ticker")).toHaveText("HONEY");

    const pay = page.getByRole("region", {name: "You will pay"});
    await expect(pay.getByText("Token creation fee")).toBeVisible();
    await expect(pay.getByText("25,000 TBZE", {exact: true})).toBeVisible();

    await details.getByRole("button", {name: "Continue"}).click();
    await expect(details).toHaveAttribute("data-state", "done");
    await expect(details).toContainText("Honey · HONEY");

    const supply = page.getByRole("region", {name: "Supply"});
    await expect(supply).toHaveAttribute("data-state", "active");
    await supply.getByRole("button", {name: "1,000,000", exact: true}).click();
    await supply.getByRole("button", {name: "Continue"}).click();
    await expect(supply).toContainText("1,000,000 HONEY to your wallet");

    const permissions = page.getByRole("region", {name: "Permissions"});
    await expect(permissions.getByRole("radio", {name: /My wallet/})).toHaveAttribute("aria-checked", "true");
    await permissions.getByRole("button", {name: "Review token"}).click();
    await expect(permissions).toContainText("Admin: your wallet");

    const review = page.getByRole("region", {name: "Review"});
    await expect(review).toHaveAttribute("data-state", "active");
    await expect(review.getByRole("region", {name: "Leaves your wallet"}).getByText("25,000 TBZE", {exact: true})).toBeVisible();
    await expect(review.getByRole("region", {name: "You get"})).toContainText("1,000,000 HONEY");
    await expect(review.getByRole("region", {name: "Permanent"})).toContainText("The ticker in its address");

    await expect(review.getByRole("button", {name: "Create token"})).toBeDisabled();
    await expect(review.getByText("Connect your wallet to create this token.")).toBeVisible();
});

test("keeps the answers in the browser and reopens on the next step", async ({page}) => {
    await page.goto("/token/new");
    const details = page.getByRole("region", {name: "Details"});
    await details.getByPlaceholder("e.g. Honey", {exact: true}).fill("Honey");
    await details.getByPlaceholder("e.g. HONEY", {exact: true}).fill("honey");
    await details.getByRole("button", {name: "Continue"}).click();
    await expect(page.getByRole("region", {name: "Supply"})).toHaveAttribute("data-state", "active");

    await page.reload();
    await expect(page.getByRole("region", {name: "Details"})).toContainText("Honey · HONEY");
    await expect(page.getByRole("region", {name: "Supply"})).toHaveAttribute("data-state", "active");

    await page.getByRole("button", {name: "Start over"}).click();
    await expect(page.getByRole("region", {name: "Details"})).toHaveAttribute("data-state", "active");
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto("/token/new");

    await expect(page.getByRole("region", {name: "You will pay"})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
