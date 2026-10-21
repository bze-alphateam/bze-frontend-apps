import {expect, test} from "./support/mock-network";

// /pool/add retired to the DEX (BFE-262): a notice with the DEX link, then the DEX itself.
// The DEX host is the testnet one from the build env, so only the path is checked.

const POOL = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/testusd_ubze";

test("shows the DEX notice and links to the same pool there", async ({page}) => {
    // Stay on the notice: the DEX is another site.
    await page.route(/\/pools(\/details)?(\?|$)/, route => route.fulfill({status: 200, contentType: "text/html", body: "<h1>DEX</h1>"}));
    await page.goto(`/pool/add?pool=${encodeURIComponent(POOL)}`);

    await expect(page.getByRole("heading", {name: "Add liquidity on the DEX"})).toBeVisible();
    await expect(page.getByText("Adding and removing liquidity now lives on the DEX.")).toBeVisible();
    const link = page.getByRole("link", {name: /Open on DEX/});
    await expect(link).toHaveAttribute("href", new RegExp(`/pools/details\\?id=${encodeURIComponent(POOL)}$`));

    // After 1.5 s it moves on to that URL.
    await page.waitForURL(new RegExp(`/pools/details\\?id=${encodeURIComponent(POOL)}$`));
});

test("without ?pool= it links to the DEX pool list", async ({page}) => {
    await page.route(/\/pools(\?|$)/, route => route.fulfill({status: 200, contentType: "text/html", body: "<h1>DEX</h1>"}));
    await page.goto("/pool/add");
    await expect(page.getByRole("link", {name: /Open on DEX/})).toHaveAttribute("href", /\/pools$/);
});
