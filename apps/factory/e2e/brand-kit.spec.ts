import {expect, test} from "./support/mock-network";

// The brand kit editor (/brand-kit, BFE-293) without a wallet. The fixture token is testnet's
// noadmin (NOAD) with its stored kit (fixtures/lcd/tokenfactory.denom_branding.noadmin.json:
// JetBrains Mono, not a template), so the templates start folded. Signing the save needs a wallet,
// which e2e has not: the message Save sends is covered by brand-kit-editor.test.tsx.

const NOADMIN = encodeURIComponent("factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin");

test("picks a template, sees it fill both palettes and the font, and reaches Save", async ({page}) => {
    await page.goto(`/brand-kit?denom=${NOADMIN}`);

    await expect(page.getByRole("heading", {level: 1})).toHaveText("Brand kit for NOAD");
    const fold = page.getByRole("button", {name: /Start from a template/});
    await expect(fold).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("combobox", {name: "Font"})).toHaveValue("jetbrains-mono");

    await fold.click();
    await page.getByRole("button", {name: "Cool"}).click();
    await page.getByRole("button", {name: "Apply the Ocean template"}).click();

    await expect(page.getByRole("combobox", {name: "Font"})).toHaveValue("inter");
    await expect(page.getByRole("textbox", {name: "Light background"})).toHaveValue("#F0F9FF");
    await expect(page.getByRole("textbox", {name: "Light primary"})).toHaveValue("#0369A1");
    await expect(page.getByRole("textbox", {name: "Dark background"})).toHaveValue("#071722");
    await expect(page.getByRole("textbox", {name: "Dark primary"})).toHaveValue("#38BDF8");
    await expect(page.getByTestId("brand-kit-template-summary")).toHaveText("Based on Ocean");
    await expect(page.getByTestId("brand-kit-undo")).toContainText("Ocean set all eight colours and the font (Inter).");

    // Folded, the box still says what the kit is based on.
    await fold.click();
    await expect(page.getByRole("button", {name: "Apply the Ocean template"})).toHaveCount(0);
    await page.getByRole("textbox", {name: "Dark primary"}).fill("#22AAFF");
    await expect(page.getByTestId("brand-kit-template-summary")).toHaveText("Based on Ocean · edited");

    await expect(page.getByTestId("brand-kit-preview-light")).toBeVisible();
    await expect(page.getByRole("button", {name: "Save brand kit"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet.")).toBeVisible();

    await page.getByRole("button", {name: "Undo"}).click();
    await expect(page.getByRole("combobox", {name: "Font"})).toHaveValue("jetbrains-mono");
    await expect(page.getByRole("textbox", {name: "Dark primary"})).toHaveValue("#ee6217");
});

test("fits a 390 px phone with the templates open", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`/brand-kit?denom=${NOADMIN}`);
    await page.getByRole("button", {name: /Start from a template/}).click();
    await expect(page.getByRole("button", {name: "Apply the Honey template"})).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
