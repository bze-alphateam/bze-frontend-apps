import {expect, test} from "./support/mock-network";
import {connectWallet, installFakeKeplr} from "./support/fake-keplr";

// The page of one DAO against hand-written chain and Scan answers (testnet has no DAO yet, see
// fixtures/README.md). DAO 2 "Founders" is a self-owned static list the e2e wallet is a member of;
// DAO 4 "Stakers club" is a stake DAO run by an outside admin who has nominated a successor.
const WALLET = "bze1qqqpkg3fxqmnu32v2ddxz6r0we7cfzuju395lw";

test.describe("a static-list DAO", () => {
    test("the header, control, treasury, rules, members and how to join", async ({page}) => {
        await page.goto("/dao/2");

        await expect(page.getByTestId("dao-type")).toHaveText("Member list");
        await expect(page.getByTestId("dao-address")).toContainText("bze1qpnpkg3fxqmnu32v2ddxz6r0we7cfzuju9qjws");
        await expect(page.getByTestId("dao-created")).toContainText("2026");
        await expect(page.getByTestId("dao-creator")).toContainText("Hive founder");
        await expect(page.getByTestId("dao-open-count")).toHaveText("1 open proposal");

        await expect(page.getByTestId("control-headline")).toHaveText("Governed by its voters");
        await expect(page.getByTestId("treasury-row")).toContainText("BZE");
        await expect(page.getByTestId("rule-quorum")).toContainText("40% of all members must vote");
        await expect(page.getByTestId("rule-cost")).toContainText("None");
        await expect(page.getByText("Proposals are free here")).toBeVisible();
        await expect(page.getByTestId("member-count")).toContainText("2 members");
        await expect(page.getByTestId("member")).toHaveCount(2);
        await expect(page.getByTestId("join-panel")).toContainText("Ask a member to propose adding you.");
        await expect(page.getByTestId("power-panel")).toHaveCount(0);
    });

    test("the description is plain text: a link only for https, markup stays text", async ({page}) => {
        await page.goto("/dao/2");

        const description = page.getByTestId("dao-description");
        await expect(description).toContainText("<script>alert(1)</script>");
        await expect(description.locator("script")).toHaveCount(0);
        await expect(description.getByRole("link")).toHaveAttribute("href", "https://getbze.com/docs");
    });

    test("a connected member sees their voting power and their votes in this DAO only", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/2");
        await connectWallet(page);

        await expect(page.getByTestId("power-headline")).toHaveText("You are a member: one member, one vote");
        await expect(page.getByTestId("power-proposal")).toContainText("Rotate the keys: you can vote");
        await expect(page.getByTestId("my-vote")).toHaveCount(1);
        await expect(page.getByTestId("my-vote")).toContainText("Yes on Buy honey");
    });

    test("the history tab lists the changes in words, newest first, and pages", async ({page}) => {
        await page.goto("/dao/2");
        await page.getByRole("tab", {name: "History"}).click();

        const items = page.getByTestId("history-item");
        await expect(items).toHaveCount(2);
        await expect(items.first()).toContainText("The member list was updated");
        await expect(items.first()).toContainText("Added:");
        await expect(items.first().getByTestId("history-link")).toHaveAttribute("href", /\/txs\/CD34$/);
        await expect(items.nth(1)).toContainText("Changed: quorum, voting period");
        await expect(items.nth(1).getByTestId("history-link")).toHaveText("View block");

        await page.getByTestId("history-more").click();
        await expect(items).toHaveCount(3);
        await expect(items.nth(2)).toContainText("The DAO was created");
    });
});

test.describe("a stake DAO", () => {
    test("an outside admin, the pending nominee, the rules and the staking sources", async ({page}) => {
        await page.goto("/dao/4");

        await expect(page.getByTestId("dao-type")).toHaveText("Stakers");
        await expect(page.getByTestId("control-headline")).toContainText("Admin: ");
        await expect(page.getByTestId("control-panel")).toContainText("can run any message as the DAO");
        await expect(page.getByTestId("control-pending")).toContainText("is nominated as the new admin");

        await expect(page.getByTestId("rule-cost")).toContainText("treasury");
        await expect(page.getByTestId("rule-deposit")).toContainText("only when the proposal passes");
        await expect(page.getByTestId("rule-expedited")).toContainText("not before 1 day");
        await expect(page.getByText("Proposals are free here")).toHaveCount(0);

        await expect(page.getByTestId("source-row")).toContainText("Staking reward 17");
        await expect(page.getByTestId("total-power")).toContainText("BZE");
        await expect(page.getByTestId("source-link")).toHaveAttribute("href", /\/staking\/details\?id=simple%3A000000000017$/);
        await expect(page.getByTestId("join-rules")).toContainText("Vote before you top up");
    });

    test("a connected staker is told when their stake does not count on an open proposal", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/4");
        await connectWallet(page);

        await expect(page.getByTestId("power-headline")).toContainText("voting power");
        await expect(page.getByTestId("power-proposal")).toContainText("your stake joined after this proposal started");
    });
});

test("an unknown DAO is not found, and so is an id that is no number", async ({page}) => {
    await page.goto("/dao/9");
    await expect(page.getByText("DAO not found")).toBeVisible();

    await page.goto("/dao/abc");
    await expect(page.getByText("DAO not found")).toBeVisible();
});

test("with Scan down the live parts render and the Scan parts offer a retry", async ({page, network}) => {
    network.use("scan", {path: "/api/scan/daos/2", status: 502, body: {error: "BZE Scan unavailable"}});
    network.use("scan", {path: "/api/scan/daos/2/history", query: {limit: "20"}, status: 502, body: {error: "BZE Scan unavailable"}});
    await page.goto("/dao/2");

    await expect(page.getByTestId("control-headline")).toHaveText("Governed by its voters");
    await expect(page.getByTestId("treasury-row")).toContainText("BZE");
    await expect(page.getByTestId("dao-creator")).toHaveCount(0);
    await expect(page.getByTestId("scan-retry")).toContainText("Who created this DAO");

    await page.getByRole("tab", {name: "History"}).click();
    await expect(page.getByTestId("history-tab").getByTestId("scan-retry")).toContainText("The history");
});

test("a node on v8.2.x shows the not-supported state", async ({page, network}) => {
    network.use("lcd", {path: "/bze/dao/dao/2", status: 501, body: {code: 12, message: "unknown service bze.dao.Query", details: []}});
    await page.goto("/dao/2");

    await expect(page.getByText("DAOs arrive with the v8.3.0 network upgrade")).toBeVisible();
});
