import {readFileSync} from "node:fs";
import {join} from "node:path";
import {expect, test, type Fixture} from "./support/mock-network";

// "Make trading smoother" (/pool/add, BFE-149) without a wallet, against the testnet fixtures.
// The NOAD/TUSDC pool comes from fixtures/lcd/tradebin.all_liquidity_pools.json
// (10 NOAD + 1 TUSDC); the tickers from fixtures/lcd/bank.denoms_metadata.json.

const NOAD_TUSDC = encodeURIComponent(
    "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/noadmin_factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/testusd",
);

const poolsFixture = (): Fixture =>
    JSON.parse(readFileSync(join(__dirname, "fixtures", "lcd", "tradebin.all_liquidity_pools.json"), "utf8")) as Fixture;

test("shows the deep-linked pool's facts, the three questions and the connect message", async ({page}) => {
    await page.goto(`/pool/add?pool=${NOAD_TUSDC}`);

    await expect(page.getByRole("heading", {name: "Make trading smoother"})).toBeVisible();
    await expect(page.getByText("tradebin · add liquidity")).toBeVisible();

    // The deep link answers question 1; its facts show again once it is reopened.
    const q1 = page.getByRole("region", {name: "Which pool?"});
    await expect(q1).toHaveAttribute("data-state", "done");
    await expect(q1).toContainText("NOAD/TUSDC");
    await expect(page.getByRole("region", {name: "How much to add?"})).toHaveAttribute("data-state", "active");
    await expect(page.getByRole("region", {name: "Price protection"})).toHaveAttribute("data-state", "todo");

    await q1.getByRole("button", {name: "Change Which pool?"}).click();
    const facts = q1.getByRole("group", {name: "Pool facts"});
    await expect(facts).toContainText("10 NOAD + 1 TUSDC");
    await expect(facts).toContainText("1 NOAD = 0.100000 TUSDC");
    await expect(facts).toContainText("Your share");

    const pay = page.getByRole("region", {name: "You will pay"});
    await expect(pay.getByText("Factory fee")).toBeVisible();
    await expect(pay.getByText("None", {exact: true})).toBeVisible();

    await expect(page.getByRole("button", {name: "Add liquidity"})).toBeDisabled();
    await expect(page.getByText("Connect your wallet to add liquidity.")).toBeVisible();
});

test("offers to create the first pool when the chain has none", async ({page, network}) => {
    const empty = poolsFixture();
    network.use("lcd", {...empty, body: {list: [], pagination: {next_key: null, total: "0"}}});
    await page.goto("/pool/add");

    await expect(page.getByText("No pools yet — create the first one.")).toBeVisible();
    await page.getByRole("button", {name: "Create a pool"}).click();
    await expect(page).toHaveURL(/\/pool\/new/);
});

test("fits a 390 px phone without horizontal scroll", async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await page.goto(`/pool/add?pool=${NOAD_TUSDC}`);

    await expect(page.getByRole("region", {name: "You will pay"})).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
