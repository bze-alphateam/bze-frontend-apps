import {expect, test} from "./support/mock-network";
import {fourScanDaos, SCAN_DAOS} from "./support/home-fixtures";

// The home page against the recorded testnet fixtures (chain params) and the hand-written
// Scan answers in e2e/fixtures/scan/ (shaped like Scan's answers with BFE-368 and BFE-423, not
// recorded). Four DAOs:
//   4 Stakers club (stake, 2 open proposals)   3 Treasury council (static list)
//   2 Founders (static list, self-owned, 1 open proposal)   1 Beekeepers (stake)

test("lists the DAOs in a table: who governs, open proposals, creation day, a link to each", async ({page}) => {
    await page.goto("/");

    await expect(page.getByRole("heading", {level: 1})).toHaveText("Decide together, on chain.");
    const rows = page.getByTestId("dao-row");
    await expect(rows).toHaveCount(4);
    await expect(rows.first()).toContainText("Stakers club");
    await expect(rows.first()).toContainText("#4");
    await expect(rows.first().getByTestId("dao-governed")).toHaveText("Stakers");
    await expect(rows.first().getByTestId("dao-open")).toHaveText("2");
    await expect(rows.first().getByTestId("dao-created")).toHaveText("4 Nov 2026");
    await expect(rows.first().getByTestId("dao-link")).toHaveAttribute("href", "/dao/4");
    await expect(rows.nth(1).getByTestId("dao-governed")).toHaveText("A member list");
    await expect(rows.nth(2).getByTestId("dao-open")).toHaveText("1");
    await expect(rows.nth(3).getByTestId("dao-open")).toHaveText("0");

    // no wallet: no You column and no My DAOs switch; everything fits one page: a count, no pager
    await expect(page.getByRole("columnheader", {name: "You"})).toHaveCount(0);
    await expect(page.getByRole("switch")).toHaveCount(0);
    await expect(page.getByTestId("list-count")).toHaveText("4 DAOs");
    await expect(page.getByRole("navigation", {name: "Pages"})).toHaveCount(0);
});

test("the home page no longer explains DAOs, lists open proposals or offers to create one", async ({page}) => {
    await page.goto("/");
    await expect(page.getByTestId("dao-row")).toHaveCount(4);

    await expect(page.getByText("What is a DAO on BeeZee?")).toHaveCount(0);
    await expect(page.getByRole("heading", {name: "Open proposals"})).toHaveCount(0);
    await expect(page.getByRole("link", {name: "Create a DAO"})).toHaveCount(0);
});

test("numbered pages: the count line, the page buttons, ?page= in the URL, and Back", async ({page, network}) => {
    const four = fourScanDaos();
    network.use("scan", {path: SCAN_DAOS, query: {page: "1", limit: "20"}, status: 200, body: {items: four, next_cursor: "c1", supported: true, total: 24}});
    network.use("scan", {path: SCAN_DAOS, query: {page: "2", limit: "20"}, status: 200, body: {items: [{...four[3], id: 0, name: "Page two DAO"}], next_cursor: null, supported: true, total: 24}});
    await page.goto("/");

    const rows = page.getByTestId("dao-row");
    const pager = page.getByRole("navigation", {name: "Pages"});
    await expect(rows).toHaveCount(4);
    await expect(page.getByTestId("list-count")).toHaveText("1–4 of 24 DAOs");
    await expect(pager.getByRole("button", {name: "Page 1"})).toHaveAttribute("aria-current", "page");
    await expect(pager.getByRole("button", {name: "Page 2"})).toBeVisible();
    await expect(pager.getByRole("button", {name: "Page 3"})).toHaveCount(0);
    await expect(pager.getByRole("button", {name: "Previous page"})).toBeDisabled();

    await pager.getByRole("button", {name: "Page 2"}).click();
    await expect(page).toHaveURL(/\/\?page=2$/);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Page two DAO");
    await expect(page.getByTestId("list-count")).toHaveText("21–21 of 24 DAOs");
    await expect(pager.getByRole("button", {name: "Page 2"})).toHaveAttribute("aria-current", "page");
    await expect(pager.getByRole("button", {name: "Next page"})).toBeDisabled();

    await page.goBack();
    await expect(page).not.toHaveURL(/page=/);
    await expect(rows).toHaveCount(4);
    await expect(page.getByTestId("list-count")).toHaveText("1–4 of 24 DAOs");
});

test("opening ?page=2 restores the second page, and a page past the end goes to the last one", async ({page, network}) => {
    const four = fourScanDaos();
    network.use("scan", {path: SCAN_DAOS, query: {page: "2", limit: "20"}, status: 200, body: {items: [{...four[3], id: 0, name: "Page two DAO"}], next_cursor: null, supported: true, total: 24}});
    network.use("scan", {path: SCAN_DAOS, query: {page: "9", limit: "20"}, status: 200, body: {items: [], next_cursor: null, supported: true, total: 24}});

    await page.goto("/?page=2");
    await expect(page.getByTestId("dao-row")).toHaveCount(1);
    await expect(page.getByTestId("list-count")).toHaveText("21–21 of 24 DAOs");

    await page.goto("/?page=9");
    await expect(page).toHaveURL(/\/\?page=2$/);
    await expect(page.getByTestId("dao-row")).toHaveCount(1);
});

test("the type filter asks Scan for that type, and the URL keeps it", async ({page}) => {
    await page.goto("/");
    await expect(page.getByTestId("dao-row")).toHaveCount(4);

    const group = page.getByRole("group", {name: "DAO type"});
    await expect(group.getByRole("button", {name: "All"})).toHaveAttribute("aria-pressed", "true");
    const asked = page.waitForRequest((request) => request.url().includes("/api/scan/daos?") && request.url().includes("type=stake"));
    await group.getByRole("button", {name: "Stakers"}).click();
    await asked;

    await expect(page.getByTestId("dao-row")).toHaveCount(2);
    await expect(page.getByTestId("dao-governed")).toHaveText(["Stakers", "Stakers"]);
    await expect(page).toHaveURL(/\/\?type=stake$/);

    await page.goto("/?type=stake");
    await expect(page.getByRole("group", {name: "DAO type"}).getByRole("button", {name: "Stakers"})).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("dao-row")).toHaveCount(2);
});

test("the name search asks Scan for the name once typing stops, and the URL keeps it", async ({page}) => {
    await page.goto("/");
    await expect(page.getByTestId("dao-row")).toHaveCount(4);

    await page.getByLabel("Search DAOs by name").fill("club");
    await expect(page.getByTestId("dao-row")).toHaveCount(1);
    await expect(page.getByTestId("dao-row")).toContainText("Stakers club");
    await expect(page).toHaveURL(/\/\?q=club$/);

    await page.goto("/?q=club");
    await expect(page.getByLabel("Search DAOs by name")).toHaveValue("club");
    await expect(page.getByTestId("dao-row")).toHaveCount(1);
});

test("a filter with no match says so", async ({page, network}) => {
    network.use("scan", {path: SCAN_DAOS, query: {q: "wasp", page: "1", limit: "20"}, status: 200, body: {items: [], next_cursor: null, supported: true, total: 0}});
    await page.goto("/?q=wasp");

    await expect(page.getByText("No DAO matches")).toBeVisible();
    await expect(page.getByText("Try another name or type.")).toBeVisible();
    await expect(page.getByTestId("dao-row")).toHaveCount(0);
});

test("an empty network says there are no DAOs yet", async ({page, network}) => {
    network.use("scan", {path: SCAN_DAOS, query: {page: "1", limit: "20"}, status: 200, body: {items: [], next_cursor: null, supported: true, total: 0}});
    await page.goto("/");

    await expect(page.getByText("No DAOs yet")).toBeVisible();
    await expect(page.getByText("DAOs created on BeeZee are listed here.")).toBeVisible();
});

test.describe("on a phone", () => {
    test.use({viewport: {width: 390, height: 844}});

    test("the DAOs are cards, the whole card links to its DAO, and the page does not scroll sideways", async ({page}) => {
        await page.goto("/");

        const cards = page.getByTestId("dao-card");
        await expect(cards).toHaveCount(4);
        await expect(page.getByTestId("dao-table")).toBeHidden();
        await expect(cards.first()).toContainText("Stakers club");
        await expect(cards.first()).toContainText("#4 · Created 4 Nov 2026");
        await expect(cards.first().getByTestId("dao-card-open")).toHaveText("2");
        await expect(cards.first().getByTestId("dao-card-governed")).toHaveText("Governed by stakers");
        await expect(cards.nth(1).getByTestId("dao-card-governed")).toHaveText("Governed by a member list");
        await expect(cards.first()).toHaveAttribute("href", "/dao/4");

        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test("the type control keeps its labels on one line, and the pager is Prev / Page n of N / Next", async ({page, network}) => {
        network.use("scan", {path: SCAN_DAOS, query: {page: "1", limit: "20"}, status: 200, body: {items: fourScanDaos(), next_cursor: "c1", supported: true, total: 61}});
        await page.goto("/");

        const member = page.getByRole("group", {name: "DAO type"}).getByRole("button", {name: "Member list"});
        await expect(member).toBeVisible();
        const box = await member.boundingBox();
        expect(box!.height).toBeLessThanOrEqual(40);

        const pager = page.getByRole("navigation", {name: "Pages"});
        await expect(pager).toContainText("Page 1 of 4");
        await expect(pager.getByRole("button", {name: "Previous page"})).toBeDisabled();
        await expect(page.getByTestId("list-count")).toHaveText("1–4 of 61 DAOs");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
});

test("the header has the DAOs link only, and /create is a plain 404", async ({page}) => {
    await page.goto("/");
    const header = page.getByTestId("app-header");
    await expect(header.getByRole("link", {name: "DAOs"}).filter({visible: true})).toHaveCount(1);
    await expect(header.getByRole("link", {name: "Create"})).toHaveCount(0);

    await page.getByRole("button", {name: "Apps"}).click();
    await expect(page.getByRole("menu").getByRole("menuitem")).toHaveText(["Website", "DEX", "Staking", "Burner", "Factory", "Communities", "Explorer"]);

    const response = await page.goto("/create");
    expect(response?.status()).toBe(404);
});

test("a proposal page opens", async ({page}) => {
    await page.goto("/proposal/9");
    await expect(page.getByTestId("proposal-number")).toHaveText("Proposal #9");
});
