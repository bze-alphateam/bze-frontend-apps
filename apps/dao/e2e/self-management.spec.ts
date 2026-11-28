import {expect, test, type MockNetwork} from "./support/mock-network";
import {connectWallet as connect, installFakeKeplr} from "./support/fake-keplr";
import type {Page} from "@playwright/test";
import {bzeWallets} from "./support/wallets";
import daoTwo from "./fixtures/lcd/dao.dao.2.json";
import adminedByDaoTwo from "./fixtures/lcd/dao.daos_by_admin.dao2.json";
import daoFour from "./fixtures/lcd/dao.dao.4.json";

// The DAO's self-management actions in the composer (BFE-376) against hand-written chain and Scan answers (see
// fixtures/README.md). DAO 2 "Founders" is a self-owned member list the e2e wallet belongs to. Every spec stops
// before signing: the fake wallet refuses to sign.
const WALLET = "bze1qqqpkg3fxqmnu32v2ddxz6r0we7cfzuju395lw";
const DAO_2_ADDRESS = "bze1qpnpkg3fxqmnu32v2ddxz6r0we7cfzuju9qjws";
const [, , , STRANGER, SUB_ADDRESS, MEADOW_ADDRESS] = bzeWallets(6);

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
        await expect(page.getByTestId("signed-by")).toContainText("Every message is signed by the DAO account");
        await expect(page.getByTestId("signed-by").locator("[title]")).toHaveAttribute("title", DAO_2_ADDRESS);
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
        network.use("lcd", {path: `/bze/dao/dao_by_address/${STRANGER}`, status: 404, body: {code: 5, message: "dao not found: key not found", details: []}});
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

        await page.getByTestId("add-action").click();
        await expect(page.getByTestId("manage-sub-dao-12")).toContainText("Manage Garden club (SubDAO)");
        await page.getByTestId("add-sub-dao-admin-12").click();
        await page.getByTestId("sub-admin-mode").selectOption("voters");
        await expect(page.getByTestId("action-error")).toHaveCount(0);
        await expect(page.getByTestId("action-preview")).toContainText("Hand the DAO to its own voters (DAO 12)");
        await expect(page.getByTestId("action-warning")).toContainText("becomes self-owned");

        await add(page, "sub-dao-execute-12");
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
        await expect(page.getByTestId("add-update-members")).toBeVisible();
        await expect(page.locator('[data-testid^="add-sub-dao-"]')).toHaveCount(0);
        await expect(page.locator('[data-testid^="manage-sub-dao-"]')).toHaveCount(0);
        await expect(page.locator('[data-testid^="add-accept-nomination"]')).toHaveCount(0);
        await expect(page.getByTestId("picker-group-other-daos")).toHaveCount(0);
    });
});

test.describe("accepting a nomination as this DAO", () => {
    // DAO 4 "Stakers club" nominated Founders; it is run by "Meadow DAO", which changed its admin (sequence 3) after
    // the nomination was made (sequence 2): the chain would refuse the acceptance (1135)
    const nominatedBy = (network: MockNetwork, meadowSeq: string) => {
        network.use("scan", {path: "/api/scan/daos", query: {pending_admin: DAO_2_ADDRESS, limit: "20"}, status: 200, body: {items: [{id: 4}], next_cursor: null, supported: true}});
        network.use("lcd", {path: "/bze/dao/dao/4", status: 200, body: {dao: {...daoFour.body.dao, admin: MEADOW_ADDRESS, pending_admin: DAO_2_ADDRESS, pending_admin_seq: "2"}}});
        network.use("lcd", {path: "/bze/dao/dao_controller/4", status: 200, body: {controller: MEADOW_ADDRESS, end_reason: "SELF_OWNED", path: [daoFour.body.dao.address, MEADOW_ADDRESS]}});
        network.use("lcd", {path: `/bze/dao/dao_by_address/${MEADOW_ADDRESS}`, status: 200, body: {dao: {...daoTwo.body.dao, id: "12", name: "Meadow DAO", address: MEADOW_ADDRESS, admin: MEADOW_ADDRESS, admin_seq: meadowSeq}}});
    };

    test("a stale nomination is listed greyed out and disabled, with why", async ({page, network}) => {
        nominatedBy(network, "3");
        await openComposer(page);
        await page.getByTestId("add-action").click();
        const stale = page.getByTestId("stale-nomination-4");
        await expect(stale).toBeVisible();
        await expect(stale).toBeDisabled();
        await expect(stale).toContainText("Accept: become the admin of Stakers club");
        await expect(stale.getByTestId("stale-pill")).toHaveText("Stale");
        await expect(stale).toContainText("Out of date: Meadow DAO, the DAO that runs Stakers club, changed its admin after Founders was nominated. Meadow DAO has to nominate it again.");
        await expect(page.getByTestId("add-accept-nomination-4")).toHaveCount(0);
    });

    test("a nomination that is still valid is offered and picks that DAO", async ({page, network}) => {
        nominatedBy(network, "2");
        await openComposer(page);
        await page.getByTestId("add-action").click();
        await expect(page.getByTestId("add-accept-nomination-4")).toContainText("Accept: become the admin of Stakers club");
        await expect(page.getByTestId("stale-nomination-4")).toHaveCount(0);
        await page.getByTestId("add-accept-nomination-4").click();
        await expect(page.getByTestId("accept-dao")).toHaveValue("4");
        await expect(page.getByTestId("accept-dao")).not.toContainText("(DAO");
    });
});

// The DAO page no longer links them (leaving and joining are proposal actions), but the composer still takes the shortcut links.
test.describe("the join / leave shortcuts", () => {
    test("the DAO page shows a member neither Leave nor Request to join", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/2");
        await connectWallet(page);
        await expect(page.getByTestId("voters-panel")).toBeVisible();
        await expect(page.getByTestId("member").first()).toBeVisible();
        await expect(page.getByRole("link", {name: /^Leave/})).toHaveCount(0);
        await expect(page.getByRole("button", {name: /^Leave/})).toHaveCount(0);
        await expect(page.getByTestId("request-to-join")).toHaveCount(0);
    });

    test("the DAO page offers Request to join to a wallet that is not a member of an open DAO, opening the composer with it", async ({page, network}) => {
        network.use("lcd", {path: "/bze/dao/dao/2", status: 200, body: founders({members: [STRANGER], config: {...config, open_submission: true}})});
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/2");
        await connectWallet(page);
        await expect(page.getByTestId("join-note")).toContainText("You're not a member. Proposals here are open to anyone");
        await expect(page.getByTestId("request-to-join")).toHaveAttribute("href", "/dao/2/propose?shortcut=join");
    });

    test("the DAO page offers no Request to join when only members can submit", async ({page, network}) => {
        network.use("lcd", {path: "/bze/dao/dao/2", status: 200, body: founders({members: [STRANGER]})});
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/2");
        await connectWallet(page);
        await expect(page.getByTestId("member").first()).toBeVisible();
        await expect(page.getByTestId("request-to-join")).toHaveCount(0);
    });

    test("the composer offers Leave to a member, and filling it in shows it prefilled", async ({page}) => {
        await openComposer(page);
        await page.getByTestId("shortcut-leave").click();
        await expect(page.getByTestId("members-remove")).toHaveValue(WALLET);
        await expect(page.getByTestId("shortcut-applied")).toContainText("Leave Founders");
        await expect(page.getByTestId("shortcut-applied")).toContainText("Prefilled");
        await expect(page.getByTestId("shortcut-join")).toHaveCount(0);
    });

    test("the only member is not offered Leave, and the leave link fills nothing in", async ({page, network}) => {
        network.use("lcd", {path: "/bze/dao/dao/2", status: 200, body: founders({members: [WALLET]})});
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/2/propose?shortcut=leave");
        await connectWallet(page);
        await expect(page.getByTestId("proposal-title")).toBeVisible();
        await expect(page.getByTestId("proposal-title")).toHaveValue("");
        await expect(page.getByTestId("no-actions")).toBeVisible();
        await expect(page.getByTestId("shortcut-leave")).toHaveCount(0);
        await expect(page.getByTestId("shortcuts")).toHaveCount(0);
    });

    test("Leave opens the composer with the wallet's removal, and the draft survives a reload", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/2/propose?shortcut=leave");
        await connectWallet(page);

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
        await page.goto("/dao/2/propose?shortcut=join");
        await connectWallet(page);

        await expect(page.getByTestId("proposal-title")).toHaveValue(/^Add bze1.* as a member$/);
        await expect(page.getByTestId("members-add")).toHaveValue(WALLET);
        await expect(page.getByTestId("action-preview")).toContainText("Add 1");
        await expect(page.getByTestId("shortcut-applied")).toContainText("Request to join Founders");
    });

    test("Request to join is not offered when only members can submit", async ({page, network}) => {
        network.use("lcd", {path: "/bze/dao/dao/2", status: 200, body: founders({members: [STRANGER]})});
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/2/propose");
        await connectWallet(page);
        await expect(page.getByTestId("gate-not-a-voter")).toBeVisible();
        await expect(page.getByTestId("shortcut-join")).toHaveCount(0);
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
        await expect(page.getByTestId("shortcut-needs-wallet")).toBeVisible();
        await expect(page.getByTestId("proposal-title")).toHaveCount(0);
    });
});
