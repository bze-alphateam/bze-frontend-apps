import type {Page} from "@playwright/test";
import {expect, test} from "./support/mock-network";
import {connectWallet as connect, installFakeKeplr} from "./support/fake-keplr";
import {fourScanDaos, SCAN_DAOS} from "./support/home-fixtures";
import {readFileSync} from "node:fs";
import {join} from "node:path";

// My DAOs for a connected wallet (a fake Keplr, see support/fake-keplr.ts). The wallet
// administers DAOs 3 and 1 (chain), is a member of 3 and 2 (Scan `member`) and stakes in a
// staking reward that DAO 4's electorate uses (x/rewards, then Scan `source`):
//   4 Staker   3 Admin + Member   2 Member   1 Admin
const WALLET = "bze1qqqpkg3fxqmnu32v2ddxz6r0we7cfzuju395lw";

// the wallet sidebar stays open after connecting and its backdrop would swallow the clicks
async function connectWallet(page: Page): Promise<void> {
    await connect(page);
    const backdrop = page.getByTestId("sidebar-backdrop");
    await expect(async () => {
        if ((await backdrop.count()) > 0) await backdrop.click({position: {x: 5, y: 5}});
        await expect(backdrop).toHaveCount(0, {timeout: 1000});
    }).toPass({timeout: 15_000});
}

const row = (page: Page, name: string) => page.getByTestId("dao-row").filter({hasText: name});

test("a visitor without a wallet sees no My DAOs switch and no You column", async ({page}) => {
    await page.goto("/");
    await expect(page.getByTestId("dao-row")).toHaveCount(4);
    await expect(page.getByRole("switch")).toHaveCount(0);
    await expect(page.getByRole("columnheader", {name: "You"})).toHaveCount(0);
});

test("a connected wallet gets the switch and a You column that says what it is in each DAO", async ({page}) => {
    await installFakeKeplr(page, WALLET);
    await page.goto("/");
    await connectWallet(page);

    await expect(page.getByRole("switch", {name: "My DAOs"})).not.toBeChecked();
    await expect(page.getByRole("columnheader", {name: "You"})).toBeVisible();
    await expect(page.getByTestId("dao-row")).toHaveCount(4);
    await expect(row(page, "Stakers club").getByTestId("dao-reason")).toHaveText(["Staker"]);
    await expect(row(page, "Treasury council").getByTestId("dao-reason")).toHaveText(["Admin", "Member"]);
    await expect(row(page, "Founders").getByTestId("dao-reason")).toHaveText(["Member"]);
    await expect(row(page, "Beekeepers").getByTestId("dao-reason")).toHaveText(["Admin"]);
});

test("the My DAOs switch narrows the table to the wallet's DAOs, counts them, and lives in the URL", async ({page, network}) => {
    // a fifth DAO the wallet has nothing to do with
    const five = [{...fourScanDaos()[0], id: 5, name: "Outsiders"}, ...fourScanDaos()];
    network.use("scan", {path: SCAN_DAOS, query: {page: "1", limit: "20"}, status: 200, body: {items: five, next_cursor: null, supported: true, total: 5}});
    await installFakeKeplr(page, WALLET);
    await page.goto("/");
    await connectWallet(page);

    await expect(page.getByTestId("dao-row")).toHaveCount(5);
    await expect(row(page, "Outsiders").getByTestId("dao-reason")).toHaveCount(0);

    await page.getByTestId("mine-switch").click();
    await expect(page.getByRole("switch", {name: "My DAOs"})).toBeChecked();
    await expect(page.getByTestId("dao-row")).toHaveCount(4);
    await expect(row(page, "Outsiders")).toHaveCount(0);
    await expect(page.getByTestId("list-count")).toHaveText("4 of your DAOs");
    await expect(page).toHaveURL(/\/\?mine=1$/);

    // the type filter applies on top, in the browser
    await page.getByRole("group", {name: "DAO type"}).getByRole("button", {name: "Stakers"}).click();
    await expect(page.getByTestId("dao-row")).toHaveCount(2);
    await expect(page.getByTestId("list-count")).toHaveText("2 of your DAOs");
    await expect(page).toHaveURL(/\/\?mine=1&type=stake$/);

    await page.getByTestId("mine-switch").click();
    await expect(page.getByTestId("dao-row")).toHaveCount(2);
    await expect(page).toHaveURL(/\/\?type=stake$/);
});

test("opening ?mine=1 turns the switch on once the wallet is connected", async ({page}) => {
    await installFakeKeplr(page, WALLET);
    await page.goto("/?mine=1");
    await connectWallet(page);

    await expect(page.getByRole("switch", {name: "My DAOs"})).toBeChecked();
    await expect(page.getByTestId("dao-row")).toHaveCount(4);
    await expect(page.getByTestId("list-count")).toHaveText("4 of your DAOs");
});

test("while Scan lacks the filters only the administered DAOs are listed, with a notice while the switch is on", async ({page, network}) => {
    network.use("scan", {path: SCAN_DAOS, query: {member: "not-an-address", limit: "1"}, status: 200, body: {items: [], next_cursor: null, supported: true}});
    await installFakeKeplr(page, WALLET);
    await page.goto("/");
    await connectWallet(page);

    await expect(page.getByTestId("dao-row")).toHaveCount(4);
    await expect(page.getByText("Only the DAOs you administer are listed")).toHaveCount(0);
    await expect(row(page, "Treasury council").getByTestId("dao-reason")).toHaveText(["Admin"]);

    await page.getByTestId("mine-switch").click();
    await expect(page.getByTestId("dao-row")).toHaveCount(2);
    await expect(page.getByTestId("dao-reason")).toHaveText(["Admin", "Admin"]);
    await expect(page.getByText("Only the DAOs you administer are listed")).toBeVisible();
});

test("a DAO that nominated the wallet as its next admin is labelled, once the chain confirms it", async ({page, network}) => {
    const dao4 = JSON.parse(readFileSync(join(__dirname, "fixtures", "lcd", "dao.dao.4.json"), "utf8")) as {body: {dao: Record<string, unknown>}};
    const staker = JSON.parse(readFileSync(join(__dirname, "fixtures", "scan", "daos.source.wallet.json"), "utf8")) as {body: {items: unknown[]}};
    // Scan names DAO 4 (and, wrongly, DAO 3); the chain's own pending admin decides
    network.use("scan", {path: SCAN_DAOS, query: {pending_admin: WALLET, limit: "100"}, status: 200, body: {items: [...staker.body.items, {...(staker.body.items[0] as object), id: 3, name: "Treasury council"}], next_cursor: null, supported: true}});
    network.use("lcd", {path: "/bze/dao/dao/4", status: 200, body: {dao: {...dao4.body.dao, pending_admin: WALLET}}});
    network.use("lcd", {path: "/bze/dao/dao/3", status: 200, body: {dao: {...dao4.body.dao, id: "3", pending_admin: ""}}});
    await installFakeKeplr(page, WALLET);
    await page.goto("/");
    await connectWallet(page);

    await expect(page.getByTestId("dao-row")).toHaveCount(4);
    await expect(row(page, "Stakers club").getByTestId("dao-reason")).toHaveText(["Nominated", "Staker"]);
    await expect(row(page, "Treasury council").getByTestId("dao-reason")).toHaveText(["Admin", "Member"]);
});
