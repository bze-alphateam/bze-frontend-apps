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
        await expect(page.getByTestId("proposal-dao")).toHaveText("Founders");
        await expect(page.getByTestId("proposal-dao")).toHaveAttribute("href", "/dao/2");
        await expect(page.getByTestId("proposal-expedited")).toHaveCount(0);
        await expect(page.getByTestId("settle-banner")).toHaveCount(0);

        // untrusted text: markup stays text, only the https link is a link
        const summary = page.getByTestId("proposal-summary");
        await expect(summary).toContainText("<img src=x onerror=alert(1)>");
        await expect(summary.locator("img")).toHaveCount(0);
        await expect(summary.getByRole("link")).toHaveAttribute("href", "https://getbze.com/keys");

        await expect(page.getByTestId("text-only")).toBeVisible();
        await expect(page.getByTestId("action")).toHaveCount(0);

        await expect(page.getByTestId("bar-quorum")).toContainText("50%, needs at least 40%");
        await expect(page.getByTestId("bar-quorum")).toHaveAttribute("data-met", "true");
        await expect(page.getByTestId("bar-threshold")).toContainText("100%, needs more than 50%");
        await expect(page.getByTestId("bar-expedite-yes")).toHaveCount(0);
        await expect(page.getByTestId("tally-verdict")).toHaveText("As it stands, it would pass when voting ends.");
        await expect(page.getByTestId("money-none")).toBeVisible();

        await expect(page.getByTestId("timeline-item")).toHaveCount(2);
        await expect(page.getByTestId("vote-row")).toHaveCount(1);
        await expect(page.getByTestId("vote-option")).toHaveText("Yes");
        await expect(page.getByTestId("my-vote-panel")).toHaveCount(0);
    });

    test("a connected member sees their ballot and what a vote would count", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/proposal/8");
        await connectWallet(page);

        await expect(page.getByTestId("my-ballot")).toContainText("You voted Yes with 1");
        await expect(page.getByTestId("eligible")).toContainText("A vote of yours would count 1.");
    });
});

test.describe("a stake proposal in voting", () => {
    test("expedited, settleable now, four actions collapsed, tally against the pinned bars, money, timeline", async ({page}) => {
        await page.goto("/proposal/9");

        await expect(page.getByTestId("proposal-status")).toHaveText("Voting");
        await expect(page.getByTestId("proposal-expedited")).toBeVisible();
        await expect(page.getByTestId("settle-banner")).toContainText("Anyone can settle this proposal now");

        const actions = page.getByTestId("action");
        await expect(actions).toHaveCount(4);
        await expect(actions.first()).not.toHaveAttribute("open", "");
        await actions.nth(0).locator("summary").click();
        await expect(actions.nth(0).getByTestId("action-title")).toContainText("from the DAO");
        await actions.nth(1).locator("summary").click();
        await expect(actions.nth(1).getByTestId("config-change").first()).toContainText("quorum: 40% → 50%");
        await expect(actions.nth(1)).toContainText("voting period: 3 days → 2 days");
        await actions.nth(2).locator("summary").click();
        await expect(actions.nth(2).getByTestId("action-title")).toContainText("Hand the DAO to its own voters");
        await actions.nth(3).locator("summary").click();
        await expect(actions.nth(3).getByTestId("action-raw")).toContainText("/cosmos.staking.v1beta1.MsgDelegate");

        await expect(page.getByTestId("tally-yes")).toContainText("BZE");
        await expect(page.getByTestId("bar-quorum")).toContainText("80%, needs at least 40%");
        await expect(page.getByTestId("bar-threshold")).toContainText("93.75%, needs more than 50%");
        await expect(page.getByTestId("bar-expedite-quorum")).toContainText("80%, needs at least 60%");
        await expect(page.getByTestId("bar-expedite-yes")).toContainText("75%, needs more than 70%");
        await expect(page.getByTestId("bar-expedite-yes")).toHaveAttribute("data-met", "true");
        await expect(page.getByTestId("tally-expedite")).toContainText("it can be settled early");

        await expect(page.getByTestId("money-cost")).toContainText("sent to the DAO's treasury");
        await expect(page.getByTestId("deposit-rule")).toContainText("refunded only if the proposal passes");

        await expect(page.locator('[data-testid="timeline-item"]')).toHaveCount(3);
        await expect(page.locator('[data-kind="early"]')).toContainText("Earliest early settle");
    });

    test("the votes show the effective weight, and the option filter narrows them", async ({page}) => {
        await page.goto("/proposal/9");

        await expect(page.getByTestId("vote-row")).toHaveCount(2);
        await expect(page.getByTestId("vote-reduced").first()).toContainText("cast with");

        await page.getByRole("tab", {name: "Yes"}).click();
        await expect(page.getByTestId("vote-row")).toHaveCount(1);
        await expect(page.getByTestId("vote-option")).toHaveText("Yes");
    });

    test("a connected staker who has not voted is told why their stake does not count", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/proposal/9");
        await connectWallet(page);

        await expect(page.getByTestId("not-voted")).toBeVisible();
        await expect(page.getByTestId("eligible-none")).toContainText("Your stake joined after this proposal started");
    });

    test("with Scan down it still renders from the chain: stake denom from the electorate, votes from the chain's ballots", async ({page, network}) => {
        network.use("scan", {path: "/api/scan/dao-proposals/9", status: 502, body: {error: "BZE Scan unavailable"}});
        network.use("scan", {path: "/api/scan/dao-proposals/9/votes", query: {limit: "20"}, status: 502, body: {error: "BZE Scan unavailable"}});
        await page.goto("/proposal/9");

        await expect(page.getByTestId("proposal-status")).toHaveText("Voting");
        await expect(page.getByTestId("scan-retry")).toContainText("could not be loaded from BZE Scan");
        await expect(page.getByTestId("tally-yes")).toContainText("BZE");
        await expect(page.getByTestId("timeline-no-scan")).toBeVisible();
        await expect(page.getByTestId("vote-row")).toHaveCount(2);
        await expect(page.getByText("read from the chain")).toBeVisible();
    });
});

test.describe("a proposal whose actions failed", () => {
    test("it passed, shows the retry deadline and the reason, and nobody is told to settle", async ({page}) => {
        await page.goto("/proposal/10");

        await expect(page.getByTestId("proposal-status")).toHaveText("Execution failed");
        await expect(page.getByTestId("status-note")).toContainText("retry until");
        await expect(page.getByTestId("settle-banner")).toHaveCount(0);
        await expect(page.locator('[data-kind="failed"]')).toContainText("a message failed");
        await expect(page.locator('[data-kind="retry"]')).toContainText("Retry deadline");
        await expect(page.getByTestId("tally-verdict")).toHaveText("The tally meets the regular bars.");
        // passed: the deposit counts as refunded under "only when it passes"
        await expect(page.getByTestId("deposit-rule")).toHaveText("It was refunded to the proposer.");
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
        await expect(page.getByTestId("deposit-released")).toContainText("kept");
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
