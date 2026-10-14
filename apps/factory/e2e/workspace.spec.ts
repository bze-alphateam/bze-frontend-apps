import {expect, test} from "./support/mock-network";

// The token workspace (/manage/token) only opens the connected wallet's own factory tokens.
// Without a wallet every denom gets the not-found state.

const DENOM = "factory%2Fbze1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq%2Futok";

test("without a wallet the workspace shows the not-found state", async ({page}) => {
    await page.goto(`/manage/token?denom=${DENOM}&tab=supply`);

    await expect(page.getByText("Token not found")).toBeVisible();
    await expect(page.getByRole("button", {name: "Back to My Tokens"})).toBeVisible();
    await expect(page.getByRole("tablist")).toHaveCount(0);
});

test("the not-found state fits a phone screen without sideways scrolling", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`/manage/token?denom=${DENOM}`);

    await expect(page.getByText("Token not found")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
