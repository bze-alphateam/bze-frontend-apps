import {expect, test} from "./support/mock-network";
import {connectWallet, installFakeKeplr} from "./support/fake-keplr";

// The page of one proposal against hand-written chain and Scan answers (testnet has no DAO yet, see
// fixtures/README.md). Proposal 8 is a static-list proposal of DAO 2 "Founders" in voting; 9 a stake
// proposal of DAO 4 "Stakers club", expedited and settleable early, with four actions; 10 a passed
// proposal of DAO 4 whose actions failed (a retry is open); 11 a rejected one the chain has cleaned up
// (Scan only); 99 does not exist anywhere.
const WALLET = "bze1qqqpkg3fxqmnu32v2ddxz6r0we7cfzuju395lw";

test.describe("a static-list proposal in voting", () => {
    test("the header, the plain-text summary, no actions, the bars met and the votes", async ({page}) => {
        await page.goto("/proposal/8");

        await expect(page.getByTestId("proposal-status")).toHaveText("Voting");
        await expect(page.getByTestId("proposal-back")).toHaveText("Founders · proposals");
        await expect(page.getByTestId("proposal-back")).toHaveAttribute("href", "/dao/2?tab=proposals");
        // the board's header: no hero, "#8" + the pill, the title, then In <DAO> · by · the clock · Explorer
        await expect(page.getByTestId("page-hero")).toHaveCount(0);
        await expect(page.getByTestId("proposal-number")).toHaveText("Proposal #8");
        await expect(page.getByRole("heading", {level: 1})).toBeVisible();
        await expect(page.getByTestId("proposal-dao")).toHaveText("In Founders");
        await expect(page.getByTestId("proposal-dao").getByRole("link")).toHaveAttribute("href", "/dao/2?tab=proposals");
        await expect(page.getByTestId("proposal-ends")).toContainText("Voting ends");
        await expect(page.getByTestId("proposal-explorer").getByRole("link")).toHaveAttribute("href", /\/daos\/2\/proposals\/8$/);
        await expect(page.getByTestId("proposal-expedited")).toHaveCount(0);
        await expect(page.getByTestId("settle-banner")).toHaveCount(0);

        // untrusted text: markup stays text, only the https link is a link
        const summary = page.getByTestId("proposal-summary");
        await expect(summary).toContainText("<img src=x onerror=alert(1)>");
        await expect(summary.locator("img")).toHaveCount(0);
        await expect(summary.getByRole("link")).toHaveAttribute("href", "https://getbze.com/keys");

        await expect(page.getByTestId("text-only")).toBeVisible();
        await expect(page.getByTestId("action")).toHaveCount(0);
        await expect(page.getByTestId("raw-messages")).toHaveCount(0);

        // a member list counts the turnout in members
        await expect(page.getByTestId("bar-quorum").getByTestId("bar-value")).toHaveText("1 of 2");
        await expect(page.getByTestId("bar-quorum").getByTestId("bar-met")).toHaveText("Met");
        await expect(page.getByTestId("bar-quorum").getByTestId("bar-text")).toHaveText("Needs at least 40 % of members");
        await expect(page.getByTestId("bar-quorum")).toHaveAttribute("data-met", "true");
        await expect(page.getByTestId("bar-threshold").getByTestId("bar-value")).toHaveText("100 %");
        await expect(page.getByTestId("bar-threshold").getByTestId("bar-text")).toHaveText("Needs more than 50 % of yes + no");
        await expect(page.getByTestId("bar-expedite-yes")).toHaveCount(0);
        await expect(page.getByTestId("tally-verdict")).toHaveText("If voting ended now, this proposal would pass.");
        await expect(page.getByTestId("money-none")).toHaveText("None: proposals in this DAO are free.");

        // text only: nothing to retry, so no retry-until step; the settle anyone can send is still to come
        await expect(page.getByTestId("timeline-item")).toHaveCount(3);
        await expect(page.getByTestId("timeline-item").first()).toContainText("Submitted by");
        await expect(page.locator('[data-kind="settle-next"]')).toContainText("by anyone");
        await expect(page.getByTestId("vote-row")).toHaveCount(1);
        await expect(page.getByTestId("vote-option")).toHaveText("Yes");
        // a member list whose votes fit on one page
        await expect(page.getByTestId("votes-panel").getByTestId("list-count")).toHaveText("1 vote · one vote per member");
        await expect(page.getByTestId("votes-panel").getByTestId("pager-desktop")).toHaveCount(0);
        // no wallet: Your vote asks to connect; there is no "What you can do" card
        await expect(page.getByTestId("your-vote")).toContainText("Not connected");
        await expect(page.getByText("What you can do")).toHaveCount(0);
    });

    test("desktop: two columns, the aside right of the main column; phone: Your vote then Tally come first", async ({page}) => {
        await page.setViewportSize({width: 1280, height: 900});
        await page.goto("/proposal/8");
        await expect(page.getByTestId("proposal-meta-phone")).toBeHidden();
        const main = await page.getByTestId("tally-panel").boundingBox();
        const aside = await page.getByTestId("your-vote").boundingBox();
        expect(main && aside && aside.x > main.x + main.width - 1).toBe(true);
        const timeline = await page.getByTestId("timeline-panel").boundingBox();
        expect(aside && timeline && timeline.y > aside.y).toBe(true);
        await expect(page.getByTestId("proposal-aside").getByTestId("money-panel")).toBeVisible();

        await page.setViewportSize({width: 390, height: 844});
        // the phone header: one line, the clock and the proposer, no "In <DAO>" and no Explorer
        await expect(page.getByTestId("proposal-meta-phone")).toBeVisible();
        await expect(page.getByTestId("proposal-meta-phone")).toContainText(/Voting ends .* · by /);
        await expect(page.getByTestId("proposal-dao")).toBeHidden();
        await expect(page.getByTestId("proposal-explorer")).toBeHidden();
        const ys = async (id: string) => (await page.getByTestId(id).boundingBox())?.y ?? -1;
        const order = ["your-vote", "tally-panel", "actions-panel", "summary-panel", "timeline-panel", "money-panel", "votes-panel"];
        const tops: number[] = [];
        for (const id of order) tops.push(await ys(id));
        expect(tops).toEqual([...tops].sort((a, b) => a - b));
        expect(tops[0]).toBeGreaterThan(0);
    });

    test("a connected member sees their ballot and what a vote would count", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/proposal/8");
        await connectWallet(page);

        await expect(page.getByTestId("my-ballot-pill")).toHaveText("Voted yes");
        await expect(page.getByTestId("my-ballot")).toContainText("Weight");
        await expect(page.getByTestId("change-vote")).toBeVisible();
    });
});

test.describe("a stake proposal in voting", () => {
    test("expedited, settleable now, four actions collapsed, tally against the pinned bars, money, timeline", async ({page}) => {
        await page.goto("/proposal/9");

        await expect(page.getByTestId("proposal-status")).toHaveText("Can settle early");
        await expect(page.getByTestId("proposal-expedited")).toBeVisible();
        await expect(page.getByTestId("proposal-ends")).toContainText("Expedited · ends");
        await expect(page.getByTestId("settle-banner")).toContainText("Can settle early");
        await expect(page.getByTestId("settle-banner")).toContainText("Anyone can settle it now instead of waiting for the end of voting.");

        // numbered cards, always open, in the order of the messages
        const actions = page.getByTestId("action");
        await expect(actions).toHaveCount(4);
        await expect(actions.nth(0)).toContainText("1");
        await expect(actions.nth(0).getByTestId("action-title")).toHaveText("Pay from the treasury");
        await expect(actions.nth(1).getByTestId("config-change").first()).toContainText("quorum: 40% → 50%");
        await expect(actions.nth(1)).toContainText("voting period: 3 days → 2 days");
        await expect(actions.nth(2).getByTestId("action-title")).toContainText("Hand Stakers club to its own voters");
        await expect(actions.nth(3).getByTestId("action-raw")).toContainText("/cosmos.staking.v1beta1.MsgDelegate");

        // the raw JSON holds all four messages, in the order of the cards
        await page.getByTestId("raw-messages").locator("summary").click();
        const raw = JSON.parse((await page.getByTestId("raw-messages-json").textContent()) ?? "null") as {"@type": string}[];
        expect(raw.map((m) => m["@type"])).toEqual([
            "/cosmos.bank.v1beta1.MsgSend", "/bze.dao.MsgUpdateDaoConfig", "/bze.dao.MsgNominateAdmin", "/cosmos.staking.v1beta1.MsgDelegate",
        ]);

        await expect(page.getByTestId("tally-yes")).toContainText("BZE");
        await expect(page.getByTestId("bar-quorum").getByTestId("bar-value")).toHaveText("80 %");
        await expect(page.getByTestId("bar-quorum").getByTestId("bar-text")).toContainText("Needs at least 40 % of");
        await expect(page.getByTestId("bar-threshold").getByTestId("bar-value")).toHaveText("93.75 %");
        await expect(page.getByTestId("bar-expedite-quorum").getByTestId("bar-value")).toHaveText("80 %");
        await expect(page.getByTestId("bar-expedite-quorum").getByTestId("bar-text")).toHaveText("Needs at least 60 %");
        await expect(page.getByTestId("bar-expedite-yes").getByTestId("bar-value")).toHaveText("75 %");
        await expect(page.getByTestId("bar-expedite-yes").getByTestId("bar-text")).toContainText("Needs more than 70 % of");
        await expect(page.getByTestId("bar-expedite-yes")).toHaveAttribute("data-met", "true");
        // the expedite pair first, then the regular bars
        await expect(page.getByTestId("tally-panel")).toContainText("To settle early (expedite bars, against all");
        await expect(page.getByTestId("tally-panel")).toContainText("At the end of voting (regular bars)");

        await expect(page.getByTestId("money-cost")).toContainText("sent to the DAO's treasury");
        await expect(page.getByTestId("money-deposit")).toContainText("held by the module");
        await expect(page.getByTestId("deposit-if-passes")).toContainText("Back to the proposer");
        await expect(page.getByTestId("deposit-rule")).toContainText("Burned");

        await expect(page.locator('[data-testid="timeline-item"]')).toHaveCount(4);
        await expect(page.locator('[data-kind="early"]')).toContainText("Earliest early settle");
        // voting end + the module's 14-day execution window
        await expect(page.locator('[data-kind="retry-until"]')).toContainText("If the actions fail, anyone can retry until then");
    });

    test("the votes show the effective weight, the count line, and the option filter with its counts narrows them", async ({page}) => {
        await page.goto("/proposal/9");

        const panel = page.getByTestId("votes-panel");
        await expect(page.getByTestId("vote-row")).toHaveCount(2);
        await expect(page.getByTestId("vote-reduced").first()).toContainText("cast with");
        await expect(panel.getByTestId("list-count")).toHaveText("2 votes");
        await expect(panel.getByTestId("vote-filter-count")).toHaveText(["2", "1", "1", "0"]);
        await expect(panel).not.toContainText("From BZE Scan");

        await page.getByRole("tab", {name: /^Yes/}).click();
        await expect(page.getByTestId("vote-row")).toHaveCount(1);
        await expect(page.getByTestId("vote-option")).toHaveText("Yes");
        await expect(panel.getByTestId("vote-filter-count")).toHaveText(["2", "1", "1", "0"]);
    });

    test("numbered vote pages: the count line and the pager, a page change reads that page", async ({page, network}) => {
        const vote = (n: number) => ({
            voter: `bze1qqqpkg3fxqmnu32v2ddxz6r0we7cfzuju${String(n).padStart(6, "0")}`, voter_label: null, option: "YES",
            weight: "1000000", effective_weight: "1000000", height: 150, tx_hash: null, time: "2026-10-28T10:00:00Z",
        });
        const answer = (from: number, count: number) => ({
            items: Array.from({length: count}, (_, i) => vote(from + i)), next_cursor: null, total: 45, option_counts: {yes: 45, no: 0, abstain: 0},
            weight_denom: {denom: "ubze", symbol: "BZE", exponent: 6},
        });
        network.use("scan", {path: "/api/scan/dao-proposals/9/votes", query: {page: "1", limit: "20"}, status: 200, body: answer(0, 20)});
        network.use("scan", {path: "/api/scan/dao-proposals/9/votes", query: {page: "2", limit: "20"}, status: 200, body: answer(20, 20)});
        await page.goto("/proposal/9");

        const panel = page.getByTestId("votes-panel");
        await expect(panel.getByTestId("list-count")).toHaveText("1–20 of 45 votes");
        await panel.getByTestId("pager-desktop").getByRole("button", {name: "Page 2"}).click();
        await expect(panel.getByTestId("list-count")).toHaveText("21–40 of 45 votes");
        await expect(panel.getByTestId("pager-desktop").getByRole("button", {name: "Page 2"})).toHaveAttribute("aria-current", "page");
    });

    test("an older Scan without a total: the votes page with Prev / Next", async ({page, network}) => {
        const base = {weight_denom: {denom: "ubze", symbol: "BZE", exponent: 6}};
        const vote = (voter: string) => ({voter, voter_label: null, option: "NO", weight: "1", effective_weight: "1", height: 150, tx_hash: null, time: "2026-10-28T10:00:00Z"});
        network.use("scan", {path: "/api/scan/dao-proposals/9/votes", query: {page: "1", limit: "20"}, status: 200, body: {...base, items: [vote("bze1qqq3kg3fxqmnu32v2ddxz6r0we7cfzujuzps7g")], next_cursor: "c2"}});
        network.use("scan", {path: "/api/scan/dao-proposals/9/votes", query: {cursor: "c2", limit: "20"}, status: 200, body: {...base, items: [vote("bze1qqqpkg3fxqmnu32v2ddxz6r0we7cfzuju395lw")], next_cursor: null}});
        await page.goto("/proposal/9");

        const panel = page.getByTestId("votes-panel");
        await expect(panel.getByTestId("list-count")).toHaveText("Page 1");
        await expect(panel.getByTestId("vote-filter-count")).toHaveCount(0);
        await panel.getByTestId("pager-desktop").getByRole("button", {name: "Next page"}).click();
        await expect(panel.getByTestId("list-count")).toHaveText("Page 2");
        await expect(page.getByTestId("vote-row")).toHaveCount(1);
    });

    test("a connected staker who has not voted is told why their stake does not count", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/proposal/9");
        await connectWallet(page);

        await expect(page.getByTestId("your-vote")).toContainText("Can't vote");
        await expect(page.getByTestId("vote-disabled-reason")).toContainText("You joined or added to your stake after this proposal started");
        // 1 BZE in staking reward 17, none of it counted, joined at block 150 (the proposal started at 100)
        await expect(page.getByTestId("not-counted")).toHaveText(/^Your 1 T?BZE in Staking reward 17 doesn't count here: you joined or added to it after this proposal started\.$/);
    });

    test("with Scan down it still renders from the chain: stake denom from the electorate, votes from the chain's ballots", async ({page, network}) => {
        network.use("scan", {path: "/api/scan/dao-proposals/9", status: 502, body: {error: "BZE Scan unavailable"}});
        network.use("scan", {path: "/api/scan/dao-proposals/9/votes", query: {page: "1", limit: "20"}, status: 502, body: {error: "BZE Scan unavailable"}});
        await page.goto("/proposal/9");

        // the chain's flags still say it is settleable early
        await expect(page.getByTestId("proposal-status")).toHaveText("Can settle early");
        await expect(page.getByTestId("scan-retry")).toContainText("could not be loaded from BZE Scan");
        await expect(page.getByTestId("tally-yes")).toContainText("BZE");
        await expect(page.getByTestId("timeline-no-scan")).toBeVisible();
        await expect(page.getByTestId("vote-row")).toHaveCount(2);
        await expect(page.getByText("read from the chain")).toBeVisible();
        await expect(page.getByTestId("votes-panel").getByTestId("pagination")).toHaveCount(0);
    });
});

test.describe("a proposal whose actions failed", () => {
    test("it passed, shows the retry deadline and the reason, and nobody is told to settle", async ({page}) => {
        await page.goto("/proposal/10");

        await expect(page.getByTestId("proposal-status")).toHaveText("Passed · execution failed");
        // the retry deadline of the fixture is over by now
        await expect(page.getByTestId("status-note")).toContainText("Too late to retry");
        await expect(page.getByTestId("settle-banner")).toHaveCount(0);
        await expect(page.locator('[data-kind="failed"]')).toContainText("a message failed");
        await expect(page.locator('[data-kind="retry"]')).toContainText("Retry deadline");
        // failed: the chain's retry_deadline, not voting end + the window
        await expect(page.locator('[data-kind="retry-until"]')).toHaveCount(0);
        await expect(page.getByTestId("tally-verdict")).toHaveText("The tally meets the regular bars.");
        // passed: Scan's record of the deposit
        await expect(page.getByTestId("deposit-released")).toContainText("Back to the proposer");
    });
});

test.describe("a proposal the chain cleaned up", () => {
    test("is read from Scan, marked Archived, with its votes, outcome and the cleanup", async ({page}) => {
        await page.goto("/proposal/11");

        await expect(page.getByTestId("proposal-archived")).toBeVisible();
        await expect(page.getByTestId("proposal-status")).toHaveText("Rejected");
        await expect(page.getByTestId("settle-banner")).toHaveCount(0);
        await expect(page.getByTestId("proposal-summary")).toContainText("Rejected long ago.");
        await expect(page.getByTestId("tally-verdict")).toHaveText("The tally does not meet the regular bars.");
        await expect(page.getByTestId("deposit-released")).toContainText("Kept");
        await expect(page.getByTestId("archived-note")).toContainText("BZE Scan's record");
        await expect(page.locator('[data-kind="cleaned"]')).toBeVisible();
        await expect(page.getByTestId("vote-row")).toHaveCount(2);
        await expect(page.getByTestId("action")).toHaveCount(1);
    });
});

test("a proposal neither the chain nor Scan knows is not found", async ({page}) => {
    await page.goto("/proposal/99");

    await expect(page.getByText("Proposal not found")).toBeVisible();
    await expect(page.getByTestId("proposal-status")).toHaveCount(0);
});

test("an id that is not a number is not found without asking anyone", async ({page}) => {
    await page.goto("/proposal/abc");

    await expect(page.getByText("Proposal not found")).toBeVisible();
});
