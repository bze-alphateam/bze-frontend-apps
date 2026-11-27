import {expect, test} from "./support/mock-network";
import {connectWallet, installFakeKeplr} from "./support/fake-keplr";
import daoTwo from "./fixtures/lcd/dao.dao.2.json";
import daoFour from "./fixtures/lcd/dao.dao.4.json";
import daosByAdminTwo from "./fixtures/lcd/dao.daos_by_admin.dao2.json";

// The page of one DAO against hand-written chain and Scan answers (testnet has no DAO yet, see
// fixtures/README.md). DAO 2 "Founders" is a self-owned static list the e2e wallet is a member of;
// DAO 4 "Stakers club" is a stake DAO run by an outside admin who has nominated a successor.
const WALLET = "bze1qqqpkg3fxqmnu32v2ddxz6r0we7cfzuju395lw";
const DAO_TWO = daoTwo.body.dao.address;

test.describe("a static-list DAO", () => {
    test("the header, who controls it, the treasury and the members", async ({page}) => {
        await page.goto("/dao/2");

        await expect(page.getByTestId("dao-back")).toHaveAttribute("href", "/");
        await expect(page.getByTestId("dao-type")).toHaveText("Governed by a member list");
        await expect(page.getByTestId("dao-name")).toHaveText("Founders");
        await expect(page.getByTestId("dao-created")).toHaveText(/^Created on .*2026$/);
        await expect(page.getByTestId("dao-address")).toContainText(DAO_TWO);
        await expect(page.getByTestId("dao-explorer")).toHaveAttribute("href", new RegExp(`/accounts/${DAO_TWO}$`));
        await expect(page.getByTestId("dao-header")).not.toContainText("DAO #");
        await expect(page.getByTestId("dao-creator")).toHaveCount(0);
        await expect(page.getByTestId("proposals-counter")).toHaveText("1/3");
        await expect(page.getByTestId("proposals-counter")).toHaveAttribute("title", "1 voting now, 3 proposals in all");

        await expect(page.getByTestId("control-admin")).toHaveAttribute("data-kind", "none");
        await expect(page.getByTestId("control-headline")).toHaveText("No admin");
        await expect(page.getByTestId("control-voters")).toContainText("2 members");
        await expect(page.getByTestId("subdaos")).toHaveCount(0);
        await expect(page.getByTestId("treasury-row")).toContainText("BZE");
        await expect(page.getByTestId("treasury-panel")).not.toContainText("held by the DAO module");
        await expect(page.getByTestId("member")).toHaveCount(2);

        // removed from the page
        await expect(page.getByTestId("rules-panel")).toHaveCount(0);
        await expect(page.getByTestId("join-panel")).toHaveCount(0);
        await expect(page.getByText("Proposals are free here")).toHaveCount(0);
        await expect(page.getByTestId("power-panel")).toHaveCount(0);
        await expect(page.getByRole("link", {name: "New proposal"})).toHaveCount(0);
    });

    test("the governance rules open inside the box, without a warning about free proposals", async ({page}) => {
        await page.goto("/dao/2");

        await expect(page.getByTestId("rules-list")).toHaveCount(0);
        await page.getByTestId("rules-toggle").click();
        const rules = page.getByTestId("control-panel").getByTestId("rules-list");
        await expect(rules.getByTestId("rule-quorum")).toContainText("40% of all members must vote");
        await expect(rules.getByTestId("rule-cost")).toContainText("None");
        await expect(rules.getByTestId("rule-deposit")).toContainText("None");
        await expect(page.getByText("Proposals are free here")).toHaveCount(0);
    });

    test("the description is plain text: a link only for https, markup stays text", async ({page}) => {
        await page.goto("/dao/2");

        const description = page.getByTestId("dao-description");
        await expect(description).toContainText("<script>alert(1)</script>");
        await expect(description.locator("script")).toHaveCount(0);
        await expect(description.getByRole("link")).toHaveAttribute("href", "https://getbze.com/docs");
        await expect(page.getByTestId("dao-description-all")).toHaveCount(0);
    });

    test("a long description is clamped, and View all opens it whole", async ({page, network}) => {
        const long = Array.from({length: 8}, (_, i) => `Paragraph ${i + 1}: we fund builders and pay for audits.`).join("\n");
        network.use("lcd", {path: "/bze/dao/dao/2", status: 200, body: {dao: {...daoTwo.body.dao, description: long}}});
        await page.goto("/dao/2");

        await page.getByTestId("dao-description-all").click();
        const dialog = page.getByTestId("dao-description-dialog");
        await expect(dialog).toContainText("About Founders");
        await expect(dialog.getByTestId("dao-description-full")).toContainText("Paragraph 8");
    });

    test("a connected member sees their voting power and their votes in this DAO only", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/2");
        await connectWallet(page);

        await expect(page.getByTestId("power-headline")).toHaveText("You are a member: one member, one vote");
        await expect(page.getByTestId("power-proposal")).toContainText("Rotate the keys: you can vote");
        await expect(page.getByTestId("power-panel")).not.toContainText("Member since");
        await expect(page.getByTestId("my-vote")).toHaveCount(1);
        await expect(page.getByTestId("my-vote")).toContainText("Yes on Buy honey");
        await expect(page.getByTestId("leave-dao")).toHaveCount(0);
        await expect(page.getByTestId("admin-console-link")).toHaveCount(0);
    });

    test("the history tab lists the changes in words, newest first, and pages", async ({page}) => {
        await page.goto("/dao/2");
        await page.getByTestId("dao-tab-history").click();
        await expect(page).toHaveURL(/\/dao\/2\?tab=history$/);

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

test.describe("the tabs live in the URL", () => {
    test("a link opens a tab, and switching tabs replaces the entry", async ({page}) => {
        await page.goto("/dao/4?tab=proposals");
        await expect(page.getByTestId("proposals-tab")).toBeVisible();
        await expect(page.getByTestId("dao-tab-proposals")).toHaveAttribute("aria-current", "page");
        await expect(page.getByTestId("proposal-row")).toHaveCount(2);

        await page.getByTestId("dao-tab-overview").click();
        await expect(page).toHaveURL(/\/dao\/4$/);
        await expect(page.getByTestId("overview-tab")).toBeVisible();
        await page.getByTestId("dao-tab-proposals").click();
        await expect(page).toHaveURL(/\/dao\/4\?tab=proposals$/);

        // the switches replaced the entry: Back leaves the DAO page instead of walking through its tabs
        await page.goBack();
        await expect(page).not.toHaveURL(/\/dao\/4/);
    });

    test("an unknown tab is the Overview", async ({page}) => {
        await page.goto("/dao/2?tab=nope");
        await expect(page.getByTestId("overview-tab")).toBeVisible();
    });

    test("New proposal sits in the Proposals tab for a connected wallet", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/4?tab=proposals");
        await connectWallet(page);
        await expect(page.getByTestId("new-proposal")).toHaveAttribute("href", "/dao/4/propose");
    });
});

test.describe("a stake DAO", () => {
    test("an outside admin, the pending nominee, the rules and the staking sources", async ({page}) => {
        await page.goto("/dao/4");

        await expect(page.getByTestId("dao-type")).toHaveText("Governed by stakers");
        // Scan's detail here has the open count but no total (an older Scan): just the open count
        await expect(page.getByTestId("proposals-counter")).toHaveText("1");
        await expect(page.getByTestId("control-admin")).toHaveAttribute("data-kind", "account");
        await expect(page.getByTestId("control-admin")).toContainText("It can run any action as the DAO and change its rules without a vote");
        await expect(page.getByTestId("control-pending")).toContainText("is nominated as the new admin");
        await expect(page.getByTestId("control-voters")).toContainText("stakers");

        await page.getByTestId("rules-toggle").click();
        await expect(page.getByTestId("rule-cost")).toContainText("treasury");
        await expect(page.getByTestId("rule-deposit")).toContainText("only when the proposal passes");
        await expect(page.getByTestId("rule-expedited")).toContainText("not before 1 day");

        await expect(page.getByTestId("source-row")).toContainText("Staking reward 17");
        await expect(page.getByTestId("total-power")).toContainText("BZE");
        await expect(page.getByTestId("source-link")).toHaveAttribute("href", /\/staking\/details\?id=simple%3A000000000017$/);
        await expect(page.getByTestId("join-rules")).toHaveCount(0);
    });

    test("a connected staker is told when their stake does not count on an open proposal", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/4");
        await connectWallet(page);

        await expect(page.getByTestId("power-headline")).toContainText("voting power");
        await expect(page.getByTestId("power-proposal")).toContainText("you joined or added to it after this proposal started");
    });
});

test("a DAO that administers another lists it as a SubDAO, with its open count", async ({page, network}) => {
    const sub = {...daoFour.body.dao, admin: DAO_TWO, pending_admin: ""};
    network.use("lcd", {...daosByAdminTwo, body: {daos: [...daosByAdminTwo.body.daos, sub], pagination: {next_key: null, total: "2"}}});
    await page.goto("/dao/2");

    const subs = page.getByTestId("subdaos");
    await expect(subs).toContainText("SubDAOs · 1");
    const row = subs.getByTestId("subdao-row");
    await expect(row).toHaveCount(1);
    await expect(row).toHaveAttribute("href", "/dao/4");
    await expect(row).toContainText("Stakers club");
    await expect(row).toContainText("Governed by stakers");
    await expect(row.getByTestId("subdao-open")).toHaveText("1 voting");
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

    await expect(page.getByTestId("control-headline")).toHaveText("No admin");
    await expect(page.getByTestId("treasury-row")).toContainText("BZE");
    await expect(page.getByTestId("dao-header").getByTestId("scan-retry")).toContainText("could not be loaded from BZE Scan");
    // the counter falls back to the chain's open proposals
    await expect(page.getByTestId("proposals-counter")).toHaveText("1");

    await page.getByTestId("dao-tab-history").click();
    await expect(page.getByTestId("history-tab").getByTestId("scan-retry")).toContainText("The history");
});

test("a node on v8.2.x shows the not-supported state", async ({page, network}) => {
    network.use("lcd", {path: "/bze/dao/dao/2", status: 501, body: {code: 12, message: "unknown service bze.dao.Query", details: []}});
    await page.goto("/dao/2");

    await expect(page.getByText("DAOs arrive with the v8.3.0 network upgrade")).toBeVisible();
});

test("on a phone the page does not scroll sideways", async ({page}) => {
    await page.setViewportSize({width: 375, height: 812});
    await page.goto("/dao/4");
    await expect(page.getByTestId("control-panel")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
