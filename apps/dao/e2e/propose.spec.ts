import {expect, test} from "./support/mock-network";
import {connectWallet, installFakeKeplr} from "./support/fake-keplr";
import {bzeWallets} from "./support/wallets";
import daoTwo from "./fixtures/lcd/dao.dao.2.json";

// The proposal composer (BFE-375) against hand-written chain and Scan answers (testnet has no DAO yet, see
// fixtures/README.md). DAO 2 "Founders" is a free, self-owned member list the e2e wallet belongs to, with
// 5,000 BZE in its treasury; DAO 4 "Stakers club" is a stake DAO that charges 5 BZE and holds 9 BZE as a deposit,
// and the e2e wallet has stake in it.
const WALLET = "bze1qqqpkg3fxqmnu32v2ddxz6r0we7cfzuju395lw";
const DAO_2_ADDRESS = "bze1qpnpkg3fxqmnu32v2ddxz6r0we7cfzuju9qjws";
const [, , , STRANGER] = bzeWallets(4);

test.describe("the entry point", () => {
    test("the DAO page links to the composer for a connected wallet", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/2");
        await connectWallet(page);
        await expect(page.getByRole("link", {name: "New proposal"})).toHaveAttribute("href", "/dao/2/propose");
    });
});

test.describe("a member of a free DAO", () => {
    test("writes a text-only proposal and sees there is nothing to pay", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/2/propose");
        await connectWallet(page);

        await expect(page.getByTestId("proposer-note")).toHaveText("You are a member of this DAO.");
        await expect(page.getByTestId("no-actions")).toBeVisible();
        await expect(page.getByTestId("expedite-box")).toHaveCount(0);
        await expect(page.getByTestId("submit-proposal")).toBeDisabled();
        await expect(page.getByTestId("submit-problem")).toHaveText("Enter a title.");

        await page.getByTestId("proposal-title").fill("Plant a hive garden");
        await page.getByTestId("proposal-summary-input").fill("Flowers for everyone.\nSee https://getbze.com/garden <b>now</b>");
        await expect(page.getByTestId("title-count")).toHaveText("19 / 140 bytes");

        await page.getByTestId("summary-preview-toggle").click();
        const preview = page.getByTestId("summary-preview");
        await expect(preview).toContainText("<b>now</b>");
        await expect(preview.locator("b")).toHaveCount(0);
        await expect(preview.getByRole("link")).toHaveAttribute("href", "https://getbze.com/garden");

        await expect(page.getByTestId("text-only")).toBeVisible();
        await expect(page.getByTestId("cost-free")).toContainText("charges nothing");
        await expect(page.getByTestId("submit-proposal")).toBeEnabled();
    });

    test("pays from the treasury: the review says what the DAO would do and warns past the balance", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/2/propose");
        await connectWallet(page);

        await page.getByTestId("proposal-title").fill("Pay the gardener");
        await page.getByTestId("add-action").click();
        await page.getByTestId("add-pay").click();

        await expect(page.getByTestId("pay-held")).toHaveText("The treasury holds 5,000 BZE.");
        await expect(page.getByTestId("submit-proposal")).toBeDisabled();

        await page.getByTestId("pay-to").fill(STRANGER);
        await page.getByTestId("pay-amount").fill("25.5");

        const preview = page.getByTestId("action-preview");
        await expect(preview).toContainText("Send 25.5 BZE from the DAO");
        await expect(page.getByTestId("action-warning")).toHaveCount(0);
        await expect(page.getByTestId("size-text")).toContainText("of 20,000 bytes");
        await expect(page.getByTestId("action").first()).toBeVisible();
        await expect(page.getByTestId("submit-proposal")).toBeEnabled();

        await page.getByTestId("pay-amount").fill("9000");
        await expect(page.getByTestId("action-warning")).toContainText("holds less than this today");
        await expect(page.getByTestId("submit-proposal")).toBeEnabled();

        await page.getByTestId("pay-amount").fill("0.0000001");
        await expect(page.getByTestId("action-error")).toContainText("at most 6 decimals");
        await expect(page.getByTestId("submit-proposal")).toBeDisabled();

        await page.getByTestId("pay-amount").fill("1.123456");
        await expect(page.getByTestId("action-preview")).toContainText("Send 1.123456 BZE from the DAO");
        await page.getByTestId("pay-to").fill("cosmos1notmine");
        await expect(page.getByTestId("action-error")).toContainText("not a valid BeeZee address");
    });

    test("actions can be moved and removed", async ({page}) => {
        await page.goto("/dao/2/propose");
        for (const amount of ["1", "2"]) {
            await page.getByTestId("add-action").click();
            await page.getByTestId("add-pay").click();
            await page.getByTestId("pay-amount").last().fill(amount);
        }
        await expect(page.getByTestId("action-row")).toHaveCount(2);
        await page.getByRole("button", {name: "Move action 2 up"}).click();
        await expect(page.getByTestId("pay-amount").first()).toHaveValue("2");
        await page.getByRole("button", {name: "Remove action 1"}).click();
        await expect(page.getByTestId("action-row")).toHaveCount(1);
        await expect(page.getByTestId("pay-amount")).toHaveValue("1");
    });

    test("a custom message must be signed by the DAO and shows what it decodes to", async ({page}) => {
        await page.goto("/dao/2/propose");
        await page.getByTestId("proposal-title").fill("Raw send");
        await page.getByTestId("add-action").click();
        await page.getByTestId("add-custom").click();

        await expect(page.getByTestId("custom-json")).toHaveValue("");
        await expect(page.getByTestId("action-row")).toHaveCount(1);

        const message = {
            "@type": "/cosmos.bank.v1beta1.MsgSend",
            from_address: DAO_2_ADDRESS,
            to_address: STRANGER,
            amount: [{denom: "ubze", amount: "1500000"}],
        };
        await page.getByTestId("custom-json").fill(JSON.stringify({...message, from_address: STRANGER}));
        await expect(page.getByTestId("action-error")).toContainText("must be signed by the DAO only");

        await page.getByTestId("custom-json").fill(JSON.stringify(message));
        await expect(page.getByTestId("action-error")).toHaveCount(0);
        await expect(page.getByTestId("action-preview")).toContainText("Send 1.5 BZE from the DAO");

        await page.getByTestId("custom-json").fill(JSON.stringify({...message, from_address: WALLET}));
        await expect(page.getByTestId("action-error")).toContainText(`"from_address" is ${WALLET}`);
        await page.getByTestId("custom-json").fill("{not json");
        await expect(page.getByTestId("action-error")).toContainText("not valid JSON");
    });

    test("an unsent draft survives a reload and can be discarded", async ({page}) => {
        await page.goto("/dao/2/propose");
        await page.getByTestId("proposal-title").fill("Keep me");
        await page.getByTestId("add-action").click();
        await page.getByTestId("add-pay").click();
        await page.getByTestId("pay-amount").fill("7");

        await page.reload();
        await expect(page.getByTestId("draft-restored")).toBeVisible();
        await expect(page.getByTestId("proposal-title")).toHaveValue("Keep me");
        await expect(page.getByTestId("pay-amount")).toHaveValue("7");

        await page.getByTestId("draft-discard").click();
        await expect(page.getByTestId("proposal-title")).toHaveValue("");
        await expect(page.getByTestId("action-row")).toHaveCount(0);
        await page.reload();
        await expect(page.getByTestId("draft-restored")).toHaveCount(0);
    });

    test("a corrupt draft is ignored", async ({page}) => {
        await page.addInitScript(() => window.localStorage.setItem("bze-dao:proposal-draft:2", "{\"v\":1,\"title\":5,\"actions\":\"x\"}{"));
        await page.goto("/dao/2/propose");
        await expect(page.getByTestId("proposal-title")).toHaveValue("");
        await expect(page.getByTestId("draft-restored")).toHaveCount(0);
    });
});

test.describe("who may propose", () => {
    test("a wallet that is not a member is told how to become one instead of getting a button", async ({page, network}) => {
        // the e2e wallet is a member of DAO 2: answer the DAO without it
        network.use("lcd", {
            path: "/bze/dao/dao/2",
            status: 200,
            body: {dao: {...daoTwo.body.dao, members: [STRANGER]}},
        });
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/2/propose");
        await connectWallet(page);

        await expect(page.getByTestId("gate-not-a-voter")).toContainText("Only the members of this DAO can submit a proposal");
        await expect(page.getByTestId("how-to-vote")).toContainText("Ask a member to propose adding you.");
        await expect(page.getByTestId("how-to-vote").getByRole("link")).toHaveAttribute("href", "/dao/2#join");
        await expect(page.getByTestId("submit-proposal")).toHaveCount(0);
    });

    test("no wallet: the form is there, the button asks to connect", async ({page}) => {
        await page.goto("/dao/2/propose");
        await expect(page.getByTestId("gate-wallet")).toBeVisible();
        await expect(page.getByTestId("submit-proposal")).toHaveCount(0);
    });
});

test.describe("a stake DAO that charges for proposals", () => {
    test("shows the cost, the deposit and what the wallet has, and the expedited rules", async ({page, network}) => {
        network.use("lcd", {
            path: `/cosmos/bank/v1beta1/spendable_balances/${WALLET}`,
            status: 200,
            body: {balances: [{denom: "ubze", amount: "12000000"}], pagination: {next_key: null, total: "1"}},
        });
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/4/propose");
        await connectWallet(page);

        await expect(page.getByTestId("proposer-note")).toContainText("You have stake in this DAO");
        await page.getByTestId("proposal-title").fill("Fund the festival");

        await expect(page.getByTestId("cost-cost")).toContainText("5 BZE is paid now and never refunded. It is sent to the DAO's treasury.");
        await expect(page.getByTestId("cost-deposit")).toContainText("9 BZE is put in escrow");
        await expect(page.getByTestId("cost-deposit")).toContainText("refunded to you only if the proposal passes");
        await expect(page.getByTestId("cost-balance")).toContainText("You need 14 BZE and have 12 BZE: not enough.");
        await expect(page.getByTestId("submit-proposal")).toBeDisabled();

        await expect(page.getByTestId("expedite-box")).toContainText("after 1 day instead of 3 days");
        await expect(page.getByTestId("expedite-box")).toContainText("more than 70% must vote Yes");
        await expect(page.getByTestId("expedite-box")).toContainText("during its first 1 day");
        await page.getByTestId("expedited-switch").check();
        await expect(page.getByTestId("review-expedited")).toBeVisible();
    });

    test("enough balance enables the button", async ({page, network}) => {
        network.use("lcd", {
            path: `/cosmos/bank/v1beta1/spendable_balances/${WALLET}`,
            status: 200,
            body: {balances: [{denom: "ubze", amount: "14000000"}], pagination: {next_key: null, total: "1"}},
        });
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/4/propose");
        await connectWallet(page);
        await page.getByTestId("proposal-title").fill("Fund the festival");
        await expect(page.getByTestId("cost-balance")).toContainText("have 14 BZE.");
        await expect(page.getByTestId("submit-proposal")).toBeEnabled();
    });
});

test.describe("failures", () => {
    test("a DAO that does not exist", async ({page}) => {
        await page.goto("/dao/9/propose");
        await expect(page.getByText("DAO not found")).toBeVisible();
    });
});
