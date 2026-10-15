import {expect, test} from "./support/mock-network";

// "Make it official" (/official, BFE-164) without a wallet. The e2e build is testnet, where the
// registry check is off (the registry lists mainnet tokens only), so nothing is fetched from
// GitHub. The entry is generated from fixtures/lcd/bank.denom_metadata.vidulum.json. Step 1
// checks a small square SVG in the browser (BFE-166).

const VDL = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/vidulum";
const LOGO = {
    name: "VDL.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#f5b800"/></svg>'),
};

test("shows the testnet banner and the entry generated from VDL's metadata", async ({page}) => {
    await page.goto(`/official?denom=${encodeURIComponent(VDL)}`);

    await expect(page.getByRole("heading", {name: "Get VDL's logo into every wallet"})).toBeVisible();
    await expect(page.getByRole("region", {name: "Registry status"})).toContainText("The registry lists mainnet tokens only.");
    await expect(page.getByTestId("official-progress")).toHaveText("Your progress: 0 of 5 steps");

    const logo = page.getByRole("region", {name: "Prepare your logo"});
    await page.getByTestId("logo-file").setInputFiles(LOGO);
    await expect(logo.getByTestId("logo-check-square")).toHaveText("Square, 64 × 64");
    await expect(logo.getByTestId("logo-check-name")).toHaveText("Name it vdl.svg when you upload it");
    await expect(logo.getByTestId("logo-preview").getByRole("img")).toHaveCount(2);
    await logo.getByRole("button", {name: "Mark as done"}).click();
    await page.getByRole("region", {name: "Add your links (optional)"}).getByRole("button", {name: "Skip"}).click();

    const entry = page.getByTestId("official-entry");
    await expect(entry).toContainText('"name": "Vidulum"');
    await expect(entry).toContainText('"symbol": "VDL"');
    await expect(entry).toContainText("https://raw.githubusercontent.com/cosmos/chain-registry/master/beezee/images/vdl.svg");
    await expect(page.getByTestId("official-progress")).toHaveText("Your progress: 2 of 5 steps");
});

test("fits a 390 px phone: the logo checks and the entry, which scrolls inside its block", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`/official?denom=${encodeURIComponent(VDL)}`);
    await page.getByTestId("logo-file").setInputFiles(LOGO);
    await expect(page.getByTestId("logo-check-format")).toHaveText("SVG, preferred");
    let overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByRole("region", {name: "Prepare your logo"}).getByRole("button", {name: "Mark as done"}).click();
    await page.getByRole("region", {name: "Add your links (optional)"}).getByRole("button", {name: "Skip"}).click();
    await expect(page.getByTestId("official-entry")).toBeVisible();

    overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
