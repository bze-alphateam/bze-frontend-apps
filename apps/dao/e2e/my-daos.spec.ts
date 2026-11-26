import {readFileSync} from "node:fs";
import {join} from "node:path";
import {expect, test} from "./support/mock-network";
import {connectWallet, installFakeKeplr} from "./support/fake-keplr";

// My DAOs for a connected wallet (a fake Keplr, see support/fake-keplr.ts). The wallet
// administers DAOs 3 and 1 (chain), is a member of 3 and 2 (Scan `member`) and stakes in a
// staking reward that DAO 4's electorate uses (x/rewards, then Scan `source`):
//   4 Staker   3 Admin + Member   2 Member   1 Admin
const WALLET = "bze1qqqpkg3fxqmnu32v2ddxz6r0we7cfzuju395lw";

test("a visitor without a wallet sees no My DAOs", async ({page}) => {
    await page.goto("/");
    await expect(page.getByTestId("dao-card")).toHaveCount(3);
    await expect(page.getByTestId("my-daos")).toHaveCount(0);
});

test("a connected wallet's DAOs say why they are there", async ({page}) => {
    await installFakeKeplr(page, WALLET);
    await page.goto("/");
    await connectWallet(page);

    const mine = page.getByTestId("my-daos");
    await expect(mine.getByTestId("dao-card")).toHaveCount(4);
    const row = (name: string) => mine.getByTestId("dao-card").filter({hasText: name});
    await expect(row("Stakers club").getByTestId("dao-reason")).toHaveText(["Staker"]);
    await expect(row("Treasury council").getByTestId("dao-reason")).toHaveText(["Admin", "Member"]);
    await expect(row("Founders").getByTestId("dao-reason")).toHaveText(["Member"]);
    await expect(row("Beekeepers").getByTestId("dao-reason")).toHaveText(["Admin"]);
});

test("while Scan lacks the filters only the administered DAOs are listed, with a notice", async ({page, network}) => {
    network.use("scan", {path: "/api/scan/daos", query: {member: "not-an-address", limit: "1"}, status: 200, body: {items: [], next_cursor: null, supported: true}});
    await installFakeKeplr(page, WALLET);
    await page.goto("/");
    await connectWallet(page);

    const mine = page.getByTestId("my-daos");
    await expect(mine.getByTestId("dao-card")).toHaveCount(2);
    await expect(mine.getByTestId("dao-reason")).toHaveText(["Admin", "Admin"]);
    await expect(mine.getByText("Only the DAOs you administer are listed")).toBeVisible();
});

test("a DAO that nominated the wallet as its next admin is labelled, once the chain confirms it", async ({page, network}) => {
    const dao4 = JSON.parse(readFileSync(join(__dirname, "fixtures", "lcd", "dao.dao.4.json"), "utf8")) as {body: {dao: Record<string, unknown>}};
    const staker = JSON.parse(readFileSync(join(__dirname, "fixtures", "scan", "daos.source.wallet.json"), "utf8")) as {body: {items: unknown[]}};
    // Scan names DAO 4 (and, wrongly, DAO 3); the chain's own pending admin decides
    network.use("scan", {path: "/api/scan/daos", query: {pending_admin: WALLET, limit: "100"}, status: 200, body: {items: [...staker.body.items, {...(staker.body.items[0] as object), id: 3, name: "Treasury council"}], next_cursor: null, supported: true}});
    network.use("lcd", {path: "/bze/dao/dao/4", status: 200, body: {dao: {...dao4.body.dao, pending_admin: WALLET}}});
    network.use("lcd", {path: "/bze/dao/dao/3", status: 200, body: {dao: {...dao4.body.dao, id: "3", pending_admin: ""}}});
    await installFakeKeplr(page, WALLET);
    await page.goto("/");
    await connectWallet(page);

    const mine = page.getByTestId("my-daos");
    await expect(mine.getByTestId("dao-card")).toHaveCount(4);
    const row = (name: string) => mine.getByTestId("dao-card").filter({hasText: name});
    await expect(row("Stakers club").getByTestId("dao-reason")).toHaveText(["Nominated", "Staker"]);
    await expect(row("Treasury council").getByTestId("dao-reason")).toHaveText(["Admin", "Member"]);
});
