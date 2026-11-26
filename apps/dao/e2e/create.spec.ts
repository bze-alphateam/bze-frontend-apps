import {expect, test} from "./support/mock-network";
import {connectWallet, installFakeKeplr} from "./support/fake-keplr";
import {bzeWallets} from "./support/wallets";

// The create flow (BFE-378) against hand-written chain answers: the wizard of both DAO types up
// to the review. The e2e wallet refuses to sign (e2e/support/fake-keplr.ts) and the RPC host has
// no fixtures, so these specs stop at the review: signing, simulation and reading the new DAO
// from the result are covered by the ui-kit unit tests (useCreateDao, created, create).
const WALLET = "bze1qqqpkg3fxqmnu32v2ddxz6r0we7cfzuju395lw";
const [OTHER] = bzeWallets(1);

test.beforeEach(async ({page, network}) => {
    network.use("lcd", {
        method: "GET",
        path: `/cosmos/bank/v1beta1/spendable_balances/${WALLET}`,
        status: 200,
        body: {balances: [{denom: "ubze", amount: "60000000000"}], pagination: {next_key: null, total: "1"}},
    });
    await installFakeKeplr(page, WALLET);
});

const toStep = async (page: import("@playwright/test").Page, name: string) => {
    await expect(page.getByTestId(`step-${name}`)).toHaveAttribute("data-state", "current");
};

test("a member-list DAO: every step to the review, with the fee and the rules in words", async ({page}) => {
    await page.goto("/create");
    await connectWallet(page);

    await toStep(page, "type");
    await expect(page.getByTestId("type-static")).toHaveAttribute("data-checked", "");
    await page.getByRole("button", {name: "Continue"}).click();

    await toStep(page, "name");
    await page.getByPlaceholder("Hive Council").fill("Hive Council");
    await page.getByRole("button", {name: "Continue"}).click();

    await toStep(page, "voters");
    const members = page.getByLabel("Members");
    await expect(members).toHaveValue(WALLET);
    await members.fill(`${WALLET}\n${OTHER}\nbze1abc`);
    await expect(page.getByTestId("member-error")).toContainText("Line 3");
    await expect(page.getByTestId("step-error")).toContainText("Line 3: Not a BZE address");
    await members.fill(`${WALLET}\n${OTHER}`);
    await expect(page.getByTestId("member-count")).toContainText("2 valid");
    await page.getByRole("button", {name: "Continue"}).click();

    await toStep(page, "admin");
    await expect(page.getByTestId("admin-voters")).toHaveAttribute("data-checked", "");
    await page.getByRole("button", {name: "Continue"}).click();

    await toStep(page, "rules");
    await page.getByTestId("preset-small-council").click();
    await expect(page.getByTestId("rules-sentence")).toContainText("at least 50 % of all members vote");
    await expect(page.getByText("Proposals are free here")).toBeVisible();
    await page.getByRole("button", {name: "Continue to review"}).click();

    await toStep(page, "review");
    await expect(page.getByTestId("review-type")).toContainText("Member list");
    await expect(page.getByTestId("review-name")).toHaveText("Hive Council");
    await expect(page.getByTestId("review-voters")).toContainText("2: you,");
    await expect(page.getByTestId("review-admin")).toContainText("None: the DAO governs itself");
    await expect(page.getByTestId("fee-amount")).toContainText("50,000 BZE");
    await expect(page.getByTestId("fee-amount")).toContainText("is burned");
    await expect(page.getByTestId("fee-balance")).toContainText("60,000 BZE");
    await expect(page.getByRole("button", {name: /Create DAO · pay 50,000 BZE/})).toBeEnabled();
});

test("a stakers DAO: the sources, the same-token rule and the live-electorate rule", async ({page}) => {
    await page.goto("/create");
    await connectWallet(page);

    await page.getByTestId("type-stake").click();
    await page.getByRole("button", {name: "Continue"}).click();
    await page.getByPlaceholder("Hive Council").fill("Noadmin Holders");
    await page.getByRole("button", {name: "Continue"}).click();

    await toStep(page, "voters");
    await expect(page.getByTestId("step-error")).toHaveCount(0);
    await expect(page.getByTestId("source-picker")).toBeVisible();
    // nothing picked yet: a DAO with no admin could not vote, but picking is the next step
    await expect(page.getByTestId("source-sr-000000000002")).toContainText("2-day lock: needs at least 5 days");
    await page.getByTestId("source-dr-factory-bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l-noadmin").locator("input").check();
    await page.getByTestId("source-sr-000000000001").locator("input").check();
    // once the noadmin token is fixed, a BZE reward cannot join
    await expect(page.getByTestId("source-sr-000000000003")).toContainText("All sources of a DAO must stake the same token");
    await expect(page.getByTestId("source-summary")).toContainText("2 rewards");
    await page.getByRole("button", {name: "Continue"}).click();

    await toStep(page, "admin");
    await expect(page.getByTestId("admin-voters")).toHaveAttribute("data-checked", "");
    await page.getByRole("button", {name: "Continue"}).click();

    await toStep(page, "rules");
    await expect(page.getByTestId("preset-token-community")).toHaveAttribute("data-checked", "");
    await page.getByRole("button", {name: "Continue to review"}).click();

    await toStep(page, "review");
    await expect(page.getByTestId("review-type")).toContainText("Stakers");
    await expect(page.getByTestId("review-voters")).toContainText("2 rewards");
    await expect(page.getByRole("button", {name: /Create DAO/})).toBeEnabled();
});

test("a self-owned stakers DAO with nothing picked is blocked, an admin lifts it", async ({page}) => {
    await page.goto("/create");
    await connectWallet(page);

    await page.getByTestId("type-stake").click();
    await page.getByRole("button", {name: "Continue"}).click();
    await page.getByPlaceholder("Hive Council").fill("Later");
    await page.getByRole("button", {name: "Continue"}).click();
    await page.getByRole("button", {name: "Continue"}).click();

    await toStep(page, "admin");
    await expect(page.getByTestId("step-error")).toContainText("something staked");
    await page.getByTestId("admin-me").locator("input").check();
    await expect(page.getByTestId("step-error")).toHaveCount(0);
    await page.getByRole("button", {name: "Continue"}).click();
    await toStep(page, "rules");
});

test("an unsent draft survives a reload", async ({page}) => {
    await page.goto("/create");
    await connectWallet(page);
    await page.getByRole("button", {name: "Continue"}).click();
    await page.getByPlaceholder("Hive Council").fill("Half written");

    await page.reload();
    await connectWallet(page);
    await page.getByRole("button", {name: "Continue"}).click();
    await expect(page.getByPlaceholder("Hive Council")).toHaveValue("Half written");
});
