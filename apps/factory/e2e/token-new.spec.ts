import type {Locator, Page} from "@playwright/test";
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
    await expect(review.getByText("Connect your wallet.")).toBeVisible();
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

test.describe("with reduced motion", () => {
    test.use({reducedMotion: "reduce"});

    test("the step that opens doesn't slide in (BFE-277)", async ({page}) => {
        await page.goto("/token/new");
        const details = page.getByRole("region", {name: "Details"});
        await details.getByPlaceholder("e.g. Honey", {exact: true}).fill("Honey");
        await details.getByPlaceholder("e.g. HONEY", {exact: true}).fill("honey");
        await details.getByRole("button", {name: "Continue"}).click();

        const supply = page.getByRole("region", {name: "Supply"});
        await expect(supply).toHaveAttribute("data-state", "active");
        expect(await supply.evaluate(el => getComputedStyle(el).animationName)).toBe("none");
    });
});

/** Presses Tab (or Shift+Tab) until `target` has the focus; fails after `max` presses. */
async function tabTo(page: Page, target: Locator, key: "Tab" | "Shift+Tab" = "Tab", max = 40) {
    for (let i = 0; i < max; i++) {
        if (await target.evaluate(el => el === document.activeElement)) return;
        await page.keyboard.press(key);
    }
    throw new Error(`could not reach ${target} with ${key}`);
}

test("can be walked and edited with the keyboard only, the focus on each step's heading (BFE-277)", async ({page}) => {
    await page.goto("/token/new");
    const details = page.getByRole("region", {name: "Details"});
    const supply = page.getByRole("region", {name: "Supply"});
    const permissions = page.getByRole("region", {name: "Permissions"});
    const review = page.getByRole("region", {name: "Review"});
    const heading = (step: Locator) => step.getByRole("heading", {level: 2});

    await tabTo(page, details.getByPlaceholder("e.g. Honey", {exact: true}));
    await page.keyboard.type("Honey");
    await tabTo(page, details.getByPlaceholder("e.g. HONEY", {exact: true}));
    await page.keyboard.type("honey");
    await tabTo(page, details.getByRole("button", {name: "Continue"}));
    await page.keyboard.press("Enter");

    await expect(supply).toHaveAttribute("data-state", "active");
    await expect(heading(supply)).toBeFocused();
    await tabTo(page, supply.getByRole("button", {name: "1,000,000", exact: true}));
    await page.keyboard.press("Enter");
    await tabTo(page, supply.getByRole("button", {name: "Continue"}));
    await page.keyboard.press("Enter");

    await expect(permissions).toHaveAttribute("data-state", "active");
    await expect(heading(permissions)).toBeFocused();
    await tabTo(page, permissions.getByRole("button", {name: "Review token"}));
    await page.keyboard.press("Enter");

    await expect(review).toHaveAttribute("data-state", "active");
    await expect(heading(review)).toBeFocused();

    // Back up to the first step and change it.
    await tabTo(page, details.getByRole("button", {name: "Edit Details"}), "Shift+Tab");
    await page.keyboard.press("Enter");
    await expect(details).toHaveAttribute("data-state", "active");
    await expect(heading(details)).toBeFocused();
    await tabTo(page, details.getByPlaceholder("e.g. Honey", {exact: true}));
    await expect(details.getByPlaceholder("e.g. Honey", {exact: true})).toHaveValue("Honey");
    await page.keyboard.press("End");
    await page.keyboard.type(" Bee");
    await expect(page.getByRole("region", {name: "What will happen"}).getByTestId("preview-name")).toHaveText("Honey Bee");
});
