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
