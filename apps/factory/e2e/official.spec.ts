import {expect, test} from "./support/mock-network";

// "Make it official" (/official, BFE-164) without a wallet. The e2e build is testnet, where the
// registry check is off (the registry lists mainnet tokens only), so nothing is fetched from
// GitHub. The entry is generated from fixtures/lcd/bank.denom_metadata.vidulum.json.

const VDL = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/vidulum";

test("shows the testnet banner and the entry generated from VDL's metadata", async ({page}) => {
    await page.goto(`/official?denom=${encodeURIComponent(VDL)}`);

    await expect(page.getByRole("heading", {name: "Get VDL's logo into every wallet"})).toBeVisible();
    await expect(page.getByRole("region", {name: "Registry status"})).toContainText("The registry lists mainnet tokens only.");
    await expect(page.getByTestId("official-progress")).toHaveText("Your progress: 0 of 5 steps");

    const logo = page.getByRole("region", {name: "Prepare your logo"});
    await expect(logo.getByRole("textbox")).toHaveValue("vdl.svg");
    await logo.getByRole("button", {name: "Mark as done"}).click();
    await page.getByRole("region", {name: "Add your links (optional)"}).getByRole("button", {name: "Skip"}).click();

    const entry = page.getByTestId("official-entry");
    await expect(entry).toContainText('"name": "Vidulum"');
    await expect(entry).toContainText('"symbol": "VDL"');
    await expect(entry).toContainText("https://raw.githubusercontent.com/cosmos/chain-registry/master/beezee/images/vdl.svg");
    await expect(page.getByTestId("official-progress")).toHaveText("Your progress: 2 of 5 steps");
});

test("fits a 390 px phone; the entry scrolls inside its block", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`/official?denom=${encodeURIComponent(VDL)}`);
    await page.getByRole("region", {name: "Prepare your logo"}).getByRole("button", {name: "Mark as done"}).click();
    await page.getByRole("region", {name: "Add your links (optional)"}).getByRole("button", {name: "Skip"}).click();
    await expect(page.getByTestId("official-entry")).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
