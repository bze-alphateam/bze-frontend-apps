import {expect, test} from "./support/mock-network";
import {connectWallet as connect, installFakeKeplr} from "./support/fake-keplr";
import type {Page} from "@playwright/test";
import {bzeWallets} from "./support/wallets";
import daoTwo from "./fixtures/lcd/dao.dao.2.json";

// The proposal composer (BFE-375) against hand-written chain and Scan answers (testnet has no DAO yet, see
// fixtures/README.md). DAO 2 "Founders" is a free, self-owned member list the e2e wallet belongs to, with
// 5,000 TBZE in its treasury (the e2e build is a testnet one: the ticker is TBZE); DAO 4 "Stakers club" is a stake DAO that charges 5 TBZE and holds 9 TBZE as a deposit,
// and the e2e wallet has stake in it.
const WALLET = "bze1qqqpkg3fxqmnu32v2ddxz6r0we7cfzuju395lw";
const DAO_2_ADDRESS = "bze1qpnpkg3fxqmnu32v2ddxz6r0we7cfzuju9qjws";
const [, , , STRANGER] = bzeWallets(4);

/** Opens the picker dialog and picks an entry: its form card opens below the list. */
async function pick(page: Page, id: string): Promise<void> {
    await page.getByTestId("add-action").click();
    await page.getByTestId("action-picker").getByTestId(`add-${id}`).click();
}

/** Connects the fake wallet and closes its sidebar (a click on the backdrop), or the backdrop swallows the clicks that follow. */
async function connectWallet(page: Page): Promise<void> {
    await connect(page);
    const backdrop = page.getByTestId("sidebar-backdrop");
    await expect(async () => {
        if ((await backdrop.count()) > 0) await backdrop.click({position: {x: 5, y: 5}});
        await expect(backdrop).toHaveCount(0, {timeout: 1000});
    }).toPass({timeout: 15_000});
}

test.describe("the entry point", () => {
    test("the DAO page's Proposals tab links to the composer for a connected wallet", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/4?tab=proposals");
        await connectWallet(page);
        await expect(page.getByRole("link", {name: "New proposal"})).toHaveAttribute("href", "/dao/4/propose");
    });

    test("the composer's top is the proposal page's: back to the DAO's Proposals tab, then the title, no breadcrumb", async ({page}) => {
        await page.goto("/dao/2/propose");
        const back = page.getByTestId("propose-back");
        await expect(back).toHaveText("Founders · proposals");
        await expect(back).toHaveAttribute("href", "/dao/2?tab=proposals");
        await expect(page.getByTestId("propose-title")).toHaveText("New proposal");
        await expect(page.getByText("← Founders")).toHaveCount(0);
    });
});

test.describe("a member of a free DAO", () => {
    test("writes a text-only proposal and sees there is nothing to pay", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/2/propose");
        await connectWallet(page);

        await expect(page.getByTestId("proposer-note")).toHaveText("You can propose: you're a member of this DAO.");
        await expect(page.getByTestId("text-only-hint")).toHaveText("No action = a text-only (signalling) proposal.");
        await expect(page.getByTestId("action-row")).toHaveCount(0);
        await expect(page.getByTestId("expedite-box")).toHaveCount(0);
        await expect(page.getByTestId("expedite-not-allowed")).toContainText("doesn't allow expedited proposals");
        await expect(page.getByTestId("submit-proposal")).toBeDisabled();
        await expect(page.getByTestId("submit-problem")).toHaveText("Enter a title.");

        await page.getByTestId("proposal-title").fill("Plant a hive garden");
        await page.getByTestId("proposal-summary-input").fill("Flowers for everyone.\nSee https://getbze.com/garden <b>now</b>");
        await expect(page.getByTestId("title-count")).toHaveText("19 of 140 bytes");

        await expect(page.getByTestId("summary-write")).toHaveAttribute("aria-pressed", "true");
        await page.getByTestId("summary-preview-toggle").click();
        await expect(page.getByTestId("summary-preview-toggle")).toHaveAttribute("aria-pressed", "true");
        const preview = page.getByTestId("summary-preview");
        await expect(preview).toContainText("<b>now</b>");
        await expect(preview.locator("b")).toHaveCount(0);
        await expect(preview.getByRole("link")).toHaveAttribute("href", "https://getbze.com/garden");

        await expect(page.getByTestId("cost-deposit").getByTestId("cost-full")).toHaveText("None");
        await expect(page.getByTestId("cost-cost").getByTestId("cost-full")).toHaveText("None");
        await expect(page.getByTestId("cost-back")).toHaveCount(0);
        await expect(page.getByTestId("draft-note")).toHaveText("Draft saved on this device. It's cleared once the proposal is submitted.");
        await expect(page.getByTestId("submit-proposal")).toBeEnabled();
    });

    test("the layout is the board's: the main card and the Before you submit aside side by side", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/2/propose");
        await connectWallet(page);
        const card = await page.getByTestId("proposal-card").boundingBox();
        const aside = await page.getByTestId("composer-aside").boundingBox();
        expect(card && aside && aside.x > card.x + card.width - 1).toBe(true);
        await expect(page.getByTestId("submit-panel")).toContainText("Before you submit");
        await expect(page.getByTestId("size-text")).toHaveText(/^\d[\d,]* of 20,000 bytes · 0 of 16 actions$/);
    });

    test("Text only, from the picker: it explains itself and adds nothing", async ({page}) => {
        await page.goto("/dao/2/propose");
        await pick(page, "text-only");
        await expect(page.getByTestId("text-only")).toContainText("Nothing runs if it passes.");
        await expect(page.getByTestId("action-row")).toHaveCount(0);
    });

    test("pays from the treasury: the review says what the DAO would do and warns past the balance", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/2/propose");
        await connectWallet(page);

        await page.getByTestId("proposal-title").fill("Pay the gardener");
        await pick(page, "pay");

        const editor = page.getByTestId("action-editor");
        await expect(editor).toContainText("cosmos.bank MsgSend from the DAO's address");
        await expect(page.getByTestId("pay-held")).toHaveText("Treasury holds 5,000 TBZE.");

        // an incomplete payment is not added
        await page.getByTestId("action-commit").click();
        await expect(page.getByTestId("action-error")).toBeVisible();
        await expect(page.getByTestId("action-row")).toHaveCount(0);

        await page.getByTestId("pay-to").fill(STRANGER);
        await page.getByTestId("pay-amount").fill("0.0000001");
        await expect(page.getByTestId("action-error")).toContainText("at most 6 decimals");
        await page.getByTestId("pay-amount").fill("9000");
        await expect(page.getByTestId("action-warning")).toContainText("holds less than this today");
        await page.getByTestId("pay-amount").fill("25.5");
        await expect(page.getByTestId("action-warning")).toHaveCount(0);
        await page.getByTestId("action-commit").click();

        const row = page.getByTestId("action-row");
        await expect(row).toHaveCount(1);
        await expect(row.getByTestId("action-card-title")).toHaveText("Pay from the treasury");
        await expect(row.getByTestId("action-preview")).toContainText("25.5 TBZE to");
        await expect(page.getByTestId("size-text")).toContainText("of 20,000 bytes · 1 of 16 actions");
        await expect(page.getByTestId("submit-proposal")).toBeEnabled();

        // edit it past the treasury: still allowed, with the warning on the card
        await row.getByTestId("action-edit").click();
        await page.getByTestId("pay-amount").fill("9000");
        await page.getByTestId("action-commit").click();
        await expect(row.getByTestId("action-warning")).toContainText("holds less than this today");
        await expect(page.getByTestId("submit-proposal")).toBeEnabled();

        // Cancel keeps the card as it was
        await row.getByTestId("action-edit").click();
        await page.getByTestId("pay-to").fill("cosmos1notmine");
        await expect(page.getByTestId("action-error")).toContainText("not a valid BeeZee address");
        await page.getByTestId("action-cancel").click();
        await expect(row.getByTestId("action-preview")).toContainText(/9,?000 TBZE to/);
    });

    test("actions can be moved and removed", async ({page}) => {
        await page.goto("/dao/2/propose");
        for (const amount of ["1", "2"]) {
            await pick(page, "pay");
            await page.getByTestId("pay-amount").fill(amount);
            await page.getByTestId("pay-to").fill(STRANGER);
            await page.getByTestId("action-commit").click();
        }
        await expect(page.getByTestId("action-row")).toHaveCount(2);
        await expect(page.getByRole("button", {name: "Move action 1 up"})).toBeDisabled();
        await page.getByRole("button", {name: "Move action 2 up"}).click();
        await expect(page.getByTestId("action-preview").first()).toContainText("2 TBZE");
        await page.getByRole("button", {name: "Remove action 1"}).click();
        await expect(page.getByTestId("action-row")).toHaveCount(1);
        await expect(page.getByTestId("action-preview")).toContainText("1 TBZE");
    });

    test("a custom message must be signed by the DAO and shows what it decodes to", async ({page}) => {
        await page.goto("/dao/2/propose");
        await page.getByTestId("proposal-title").fill("Raw send");
        await pick(page, "custom");

        await expect(page.getByTestId("custom-json")).toHaveValue("");
        await expect(page.getByTestId("advanced-pill")).toHaveText("Advanced");
        await expect(page.getByTestId("action-row")).toHaveCount(0);

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
        await expect(page.getByTestId("action-editor")).toContainText("Looks right");
        await expect(page.getByTestId("action-decoded")).toContainText("Send 1.5 TBZE from the DAO");

        await page.getByTestId("custom-json").fill(JSON.stringify({...message, from_address: WALLET}));
        await expect(page.getByTestId("action-error")).toContainText(`"from_address" is ${WALLET}`);
        await page.getByTestId("custom-json").fill("{not json");
        await expect(page.getByTestId("action-error")).toContainText("not valid JSON");

        await page.getByTestId("custom-json").fill(JSON.stringify(message));
        await page.getByTestId("action-commit").click();
        await expect(page.getByTestId("action-card-title")).toHaveText("Custom message (advanced)");
        await expect(page.getByTestId("action-preview")).toContainText("1.5 TBZE to");
    });

    test("an unsent draft survives a reload and can be discarded", async ({page}) => {
        await page.goto("/dao/2/propose");
        await page.getByTestId("proposal-title").fill("Keep me");
        await pick(page, "pay");
        await page.getByTestId("pay-amount").fill("7");
        await page.getByTestId("pay-to").fill(STRANGER);
        await page.getByTestId("action-commit").click();

        await page.reload();
        await expect(page.getByTestId("draft-restored")).toBeVisible();
        await expect(page.getByTestId("proposal-title")).toHaveValue("Keep me");
        await expect(page.getByTestId("action-preview")).toContainText("7 TBZE to");

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

        await expect(page.getByTestId("gate-not-a-voter")).toContainText("Not a member");
        await expect(page.getByTestId("gate-not-a-voter")).toContainText("Proposals here are for members. Ask a member to propose adding you.");
        await expect(page.getByTestId("gate-not-a-voter").getByRole("link")).toHaveCount(0);
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

        await expect(page.getByTestId("cost-cost")).toContainText("5 TBZE, paid now and never refunded (to the treasury)");
        await expect(page.getByTestId("cost-deposit")).toContainText("9 TBZE, held while voting");
        await expect(page.getByTestId("cost-back")).toContainText("Only if it passes; otherwise");
        await expect(page.getByTestId("cost-balance")).toContainText("12 TBZE · not enough, you need 14 TBZE");
        await expect(page.getByTestId("submit-proposal")).toBeDisabled();

        await expect(page.getByTestId("expedite-explanation")).toContainText("Shorter vote (1 day) that can settle early, at the earliest 1 day after submission");
        await expect(page.getByTestId("expedite-explanation")).toContainText("yes is more than 70% of ALL voting power");
        await page.getByTestId("expedited-switch").check();
        await expect(page.getByTestId("expedited-switch")).toBeChecked();
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
        await expect(page.getByTestId("cost-balance")).toHaveText("You hold14 TBZE ✓");
        await expect(page.getByTestId("submit-proposal")).toBeEnabled();
    });
});

test.describe("on a phone (board I5)", () => {
    test.beforeEach(async ({page}) => {
        await page.setViewportSize({width: 390, height: 1400});
    });

    test("no Write / Preview switch, a 4-row summary and its one counter line", async ({page}) => {
        await page.goto("/dao/2/propose");
        await page.getByTestId("proposal-summary-input").fill("Flowers.");
        await expect(page.getByTestId("summary-view")).toBeHidden();
        await expect(page.getByTestId("summary-count")).toBeHidden();
        await expect(page.getByTestId("summary-count-phone")).toHaveText("Plain text · 8 of 5,000 bytes");
        const box = await page.getByTestId("proposal-summary-input").boundingBox();
        expect(box && box.height).toBeLessThan(130);
    });

    test("the short expedited line, the short cost values, and no footnotes or draft card", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/4/propose");
        await connectWallet(page);
        await expect(page.getByTestId("expedite-explanation-phone")).toHaveText("1-day vote that can settle early.");
        await expect(page.getByTestId("expedite-explanation")).toBeHidden();

        const deposit = page.getByTestId("cost-deposit");
        await expect(deposit.getByTestId("cost-short")).toHaveText("9 TBZE");
        await expect(deposit.getByTestId("cost-full")).toBeHidden();
        await expect(page.getByTestId("cost-back").getByTestId("cost-short")).toHaveText("Only if it passes");
        await expect(page.getByTestId("cost-cost").getByTestId("cost-short")).toHaveText("5 TBZE");
        expect(await deposit.evaluate((el) => getComputedStyle(el).paddingTop)).toBe("6px");

        await expect(page.getByTestId("cost-note")).toBeHidden();
        await expect(page.getByTestId("proposal-slots")).toBeHidden();
        await expect(page.getByTestId("draft-card")).toBeHidden();
        await expect(page.getByTestId("submit-proposal")).toBeVisible();
    });
});

test.describe("failures", () => {
    test("a DAO that does not exist", async ({page}) => {
        await page.goto("/dao/9/propose");
        await expect(page.getByText("DAO not found")).toBeVisible();
    });
});
