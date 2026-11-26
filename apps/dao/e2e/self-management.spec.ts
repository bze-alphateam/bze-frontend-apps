import {expect, test} from "./support/mock-network";
import {connectWallet as connect, installFakeKeplr} from "./support/fake-keplr";
import type {Page} from "@playwright/test";
import {bzeWallets} from "./support/wallets";
import daoTwo from "./fixtures/lcd/dao.dao.2.json";
import adminedByDaoTwo from "./fixtures/lcd/dao.daos_by_admin.dao2.json";

// The DAO's self-management actions in the composer (BFE-376) against hand-written chain and Scan answers (see
// fixtures/README.md). DAO 2 "Founders" is a self-owned member list the e2e wallet belongs to. Every spec stops
// before signing: the fake wallet refuses to sign.
const WALLET = "bze1qqqpkg3fxqmnu32v2ddxz6r0we7cfzuju395lw";
const DAO_2_ADDRESS = "bze1qpnpkg3fxqmnu32v2ddxz6r0we7cfzuju9qjws";
const [, , , STRANGER, SUB_ADDRESS] = bzeWallets(5);

const config = {
    ...daoTwo.body.dao.config,
    allow_expedite: true,
    expedited_period: "86400s",
    expedite_quorum: "0.600000000000000000",
    expedite_threshold: "0.700000000000000000",
};

/** A DAO 2 whose rules the chain would accept as they are (the stored fixture has zeros in the expedite fields). */
const founders = (over: Record<string, unknown> = {}) => ({dao: {...daoTwo.body.dao, config, ...over}});

async function connectWallet(page: Page): Promise<void> {
    await connect(page);
    const backdrop = page.getByTestId("sidebar-backdrop");
    await expect(async () => {
        if ((await backdrop.count()) > 0) await backdrop.click({position: {x: 5, y: 5}});
        await expect(backdrop).toHaveCount(0, {timeout: 1000});
    }).toPass({timeout: 15_000});
}

async function openComposer(page: Page): Promise<void> {
    await installFakeKeplr(page, WALLET);
    await page.goto("/dao/2/propose");
    await connectWallet(page);
    await page.getByTestId("proposal-title").fill("A change");
}

const add = async (page: Page, id: string) => {
    await page.getByTestId("add-action").click();
    await page.getByTestId(`add-${id}`).click();
};

test.describe("members", () => {
    test("propose adding a member: checked, read back, ready to submit", async ({page, network}) => {
        network.use("lcd", {path: "/bze/dao/dao/2", status: 200, body: founders()});
        await openComposer(page);
        await add(page, "update-members");

        await expect(page.getByTestId("submit-proposal")).toBeDisabled();
        await page.getByTestId("members-add").fill(STRANGER);
        await expect(page.getByTestId("action-error")).toHaveCount(0);
        await expect(page.getByTestId("action-preview")).toContainText("Change the members");
        await expect(page.getByTestId("action-preview")).toContainText("Add 1");
        await expect(page.getByTestId("action-warning")).toContainText("only on proposals submitted after");
        await expect(page.getByTestId("signed-by")).toContainText(DAO_2_ADDRESS.slice(0, 10));
        await expect(page.getByTestId("submit-proposal")).toBeEnabled();

        await page.getByTestId("members-add").fill(WALLET);
        await expect(page.getByTestId("action-error")).toContainText("is already a member");
        await expect(page.getByTestId("submit-proposal")).toBeDisabled();

        await page.getByTestId("members-add").fill(STRANGER);
        await page.getByTestId("members-remove").fill(STRANGER);
        await expect(page.getByTestId("action-error")).toContainText("both added and removed");
    });

    test("removing every member is refused", async ({page}) => {
        await openComposer(page);
        await add(page, "update-members");
        await page.getByTestId("members-remove").fill(`${WALLET}\nbze1qqq3kg3fxqmnu32v2ddxz6r0we7cfzujuzps7g`);
        await expect(page.getByTestId("action-error")).toContainText("at least one member");
    });
});

test.describe("rename and rules", () => {
    test("rename: the form starts from today's name, an empty name is refused", async ({page}) => {
        await openComposer(page);
        await add(page, "update-metadata");

        await expect(page.getByTestId("meta-name")).toHaveValue("Founders");
        await page.getByTestId("meta-name").fill("Founders of the hive");
        await expect(page.getByTestId("action-preview")).toContainText("Name: Founders of the hive");
        await expect(page.getByTestId("submit-proposal")).toBeEnabled();

        await page.getByTestId("meta-name").fill("");
        await expect(page.getByTestId("action-error")).toContainText("Enter a name.");
        await page.getByTestId("meta-name").fill("x".repeat(65));
        await expect(page.getByTestId("action-error")).toContainText("at most 64 bytes");
    });

    test("rules: what changes is shown before and after, and open proposals keep theirs", async ({page, network}) => {
        network.use("lcd", {path: "/bze/dao/dao/2", status: 200, body: founders()});
        await openComposer(page);
        await add(page, "update-rules");

        await expect(page.getByTestId("rules-note")).toContainText("open now keep the rules they started with");
        await page.getByTestId("rules-form").locator("input[inputmode=decimal]").first().fill("45");

        const change = page.getByTestId("action-preview").getByTestId("config-change");
        await expect(change).toHaveCount(1);
        await expect(change).toContainText("quorum: 40% → 45%");
        await expect(page.getByTestId("submit-proposal")).toBeEnabled();

        await page.getByTestId("rules-form").locator("input[inputmode=decimal]").first().fill("0");
        await expect(page.getByTestId("action-error")).toContainText("quorum must be above 0%");
    });
});

test.describe("the admin", () => {
    test("nominate an admin: for the DAO, who has to accept, with what an external admin can do", async ({page}) => {
        await openComposer(page);
        await add(page, "nominate-admin");

        await page.getByTestId("nominee").fill("cosmos1nope");
        await expect(page.getByTestId("action-error")).toContainText("not a valid BeeZee address");
        await page.getByTestId("nominee").fill(DAO_2_ADDRESS);
        await expect(page.getByTestId("action-error")).toContainText("cannot nominate itself");

        await page.getByTestId("nominee").fill(STRANGER);
        await expect(page.getByTestId("action-error")).toHaveCount(0);
        await expect(page.getByTestId("action-preview")).toContainText("Nominate a new admin for DAO 2 (they have to accept)");
        await expect(page.getByTestId("action-warning")).toContainText("spending the whole treasury");
        await expect(page.getByTestId("submit-proposal")).toBeEnabled();
    });

    test("a DAO with an admin is not offered the handover", async ({page, network}) => {
        network.use("lcd", {path: "/bze/dao/dao/2", status: 200, body: founders({admin: STRANGER})});
        await openComposer(page);
        await page.getByTestId("add-action").click();
        await expect(page.getByTestId("add-update-members")).toBeVisible();
        await expect(page.getByTestId("add-nominate-admin")).toHaveCount(0);
        await expect(page.getByTestId("add-withdraw-nomination")).toHaveCount(0);
    });
});

test.describe("the DAOs this DAO administers", () => {
    test("hand a sub-DAO to its voters and run a payment as it", async ({page, network}) => {
        const sub = {
            ...daoTwo.body.dao, id: "12", address: SUB_ADDRESS, admin: DAO_2_ADDRESS, name: "Garden club", members: [WALLET],
        };
        network.use("lcd", {
            path: `/bze/dao/daos_by_admin/${DAO_2_ADDRESS}`,
            query: {"pagination.limit": "50"},
            status: 200,
            body: {...adminedByDaoTwo.body, daos: [...adminedByDaoTwo.body.daos, sub]},
        });
        network.use("lcd", {
            path: `/cosmos/bank/v1beta1/spendable_balances/${SUB_ADDRESS}`,
            status: 200,
            body: {balances: [{denom: "ubze", amount: "90000000"}], pagination: {next_key: null, total: "1"}},
        });
        await openComposer(page);

        await add(page, "sub-dao-admin");
        await page.getByTestId("sub-admin-mode").selectOption("voters");
        await expect(page.getByTestId("action-error")).toHaveCount(0);
        await expect(page.getByTestId("action-preview")).toContainText("Hand the DAO (DAO 12) to its own voters");
        await expect(page.getByTestId("action-warning")).toContainText("becomes self-owned");

        await add(page, "sub-dao-execute");
        const nested = page.getByTestId("nested-actions");
        await nested.getByTestId("add-action").click();
        await nested.getByTestId("add-pay").click();
        await expect(nested.getByTestId("pay-held")).toHaveText("The treasury holds 90 TBZE.");
        await nested.getByTestId("pay-amount").fill("12.5");
        await nested.getByTestId("pay-to").fill(STRANGER);
        await expect(page.getByTestId("action-preview").last()).toContainText("Send 12.5 TBZE from the sub-DAO (DAO 12)");
        await expect(page.getByTestId("submit-proposal")).toBeEnabled();
    });

    test("without a sub-DAO the actions are not offered", async ({page}) => {
        await openComposer(page);
        await page.getByTestId("add-action").click();
        await expect(page.getByTestId("add-sub-dao-admin")).toHaveCount(0);
        await expect(page.getByTestId("add-sub-dao-execute")).toHaveCount(0);
        await expect(page.getByTestId("add-accept-nomination")).toHaveCount(0);
    });
});

test.describe("the shortcuts on the DAO page", () => {
    test("Leave opens the composer with the wallet's removal, and the draft survives a reload", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/2");
        await connectWallet(page);
        await expect(page.getByTestId("leave-dao")).toHaveAttribute("href", "/dao/2/propose?shortcut=leave");
        await page.getByTestId("leave-dao").click();

        await expect(page.getByTestId("proposal-title")).toHaveValue(/^Remove bze1.* as a member$/);
        await expect(page.getByTestId("members-remove")).toHaveValue(WALLET);
        await expect(page.getByTestId("members-add")).toHaveValue("");
        await expect(page).toHaveURL(/\/dao\/2\/propose$/);
        await expect(page.getByTestId("submit-proposal")).toBeEnabled();

        await page.reload();
        await expect(page.getByTestId("draft-restored")).toBeVisible();
        await expect(page.getByTestId("members-remove")).toHaveValue(WALLET);
    });

    test("Request to join is for a wallet that is not a member of an open DAO", async ({page, network}) => {
        network.use("lcd", {path: "/bze/dao/dao/2", status: 200, body: founders({members: [STRANGER], config: {...config, open_submission: true}})});
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/2");
        await connectWallet(page);
        await expect(page.getByTestId("leave-dao")).toHaveCount(0);
        await page.getByTestId("request-to-join").click();

        await expect(page.getByTestId("proposal-title")).toHaveValue(/^Add bze1.* as a member$/);
        await expect(page.getByTestId("members-add")).toHaveValue(WALLET);
        await expect(page.getByTestId("action-preview")).toContainText("Add 1");
    });

    test("the only member cannot leave, and is told why", async ({page, network}) => {
        network.use("lcd", {path: "/bze/dao/dao/2", status: 200, body: founders({members: [WALLET]})});
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/2");
        await connectWallet(page);
        await expect(page.getByTestId("leave-blocked")).toContainText("only member");
        await expect(page.getByTestId("leave-dao")).toHaveCount(0);
    });

    test("an unsent draft wins over the shortcut, and says so", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.addInitScript(() => window.localStorage.setItem("bze-dao:proposal-draft:2", JSON.stringify({v: 1, title: "Keep me", summary: "", expedited: false, actions: []})));
        await page.goto("/dao/2/propose?shortcut=leave");
        await connectWallet(page);
        await expect(page.getByTestId("draft-restored")).toContainText("shortcut you followed was not applied");
        await expect(page.getByTestId("proposal-title")).toHaveValue("Keep me");
    });

    test("without a wallet the link waits for one", async ({page}) => {
        await page.goto("/dao/2/propose?shortcut=join");
        await expect(page.getByText("Connect your wallet", {exact: true})).toBeVisible();
        await expect(page.getByTestId("proposal-title")).toHaveCount(0);
    });
});
