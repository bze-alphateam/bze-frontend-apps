import {readFileSync} from "node:fs";
import {join} from "node:path";
import type {Page} from "@playwright/test";
import {expect, test, type MockNetwork} from "./support/mock-network";
import {connectWallet as connect, installFakeKeplr} from "./support/fake-keplr";
import {bzeWallets} from "./support/wallets";
import daoTwo from "./fixtures/lcd/dao.dao.2.json";
import daoFour from "./fixtures/lcd/dao.dao.4.json";

// The admin console (BFE-377) against hand-written chain and Scan answers (see fixtures/README.md).
// DAO 2 "Founders" is turned into an admin-run member list for the specs that need an admin, DAO 4
// "Stakers club" is admin-run already. The e2e wallets approve connections and refuse to sign, so every
// spec stops before the signature: what is offered, who is let in, what is shown before signing, and the
// refusal that comes back (no transaction is ever broadcast). The messages, the sign options and the
// flows after a signature are unit-tested with an injected signer.
const WALLET = "bze1qqqpkg3fxqmnu32v2ddxz6r0we7cfzuju395lw";
const [, , , STRANGER, NOMINEE] = bzeWallets(5);
const NOT_A_DAO = {code: 5, message: "dao not found: key not found", details: []};

const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", "lcd", name), "utf8")) as {path: string; query?: Record<string, string>; status: number; body: unknown};

/** DAO 2 with an outside admin: the e2e wallet unless said otherwise (a person, not a DAO). */
const adminRun = (network: MockNetwork, over: Record<string, unknown> = {}, admin = WALLET) => {
    network.use("lcd", {path: "/bze/dao/dao/2", status: 200, body: {dao: {...daoTwo.body.dao, admin, ...over}}});
    for (const address of [admin, over.pending_admin as string | undefined]) {
        if (address) network.use("lcd", {path: `/bze/dao/dao_by_address/${address}`, status: 404, body: NOT_A_DAO});
    }
};

/** What the app reads for a connected wallet in every page (balances, staking), for a wallet that has no fixtures of its own. */
const asWallet = (network: MockNetwork, address: string) => {
    for (const name of ["bank.spendable_balances.wallet.json", "rewards.staking_reward_participant.wallet.json", "rewards.denom_reward_participations.wallet.json"]) {
        const base = fixture(name);
        network.use("lcd", {...base, path: base.path.replace(WALLET, address)});
    }
};

async function connectWallet(page: Page): Promise<void> {
    await connect(page);
    const backdrop = page.getByTestId("sidebar-backdrop");
    await expect(async () => {
        if ((await backdrop.count()) > 0) await backdrop.click({position: {x: 5, y: 5}});
        await expect(backdrop).toHaveCount(0, {timeout: 1000});
    }).toPass({timeout: 15_000});
}

async function openConsole(page: Page, address: string, id = "2"): Promise<void> {
    await installFakeKeplr(page, address);
    await page.goto(`/dao/${id}/admin`);
    await connectWallet(page);
}

test.describe("who gets the console", () => {
    test("the admin finds the link on the DAO page, which leads to the console", async ({page, network}) => {
        adminRun(network);
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/2");
        await connectWallet(page);

        await page.getByTestId("admin-console-link").click();
        await expect(page).toHaveURL(/\/dao\/2\/admin$/);
        await expect(page.getByTestId("admin-console")).toHaveAttribute("data-role", "admin");
        await expect(page.getByTestId("admin-warning")).toContainText("spending the whole treasury");
    });

    test("a stranger has no link on the DAO page", async ({page, network}) => {
        adminRun(network, {}, STRANGER);
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/2");
        await connectWallet(page);
        await expect(page.getByTestId("dao-actions")).toBeVisible();
        await expect(page.getByTestId("admin-console-link")).toHaveCount(0);
    });

    test("a stranger who types the address gets no console", async ({page, network}) => {
        adminRun(network, {}, STRANGER);
        await openConsole(page, WALLET);
        await expect(page.getByTestId("no-console")).toBeVisible();
        await expect(page.getByTestId("execute-panel")).toHaveCount(0);
    });

    test("a self-owned DAO has no admin console, even typed into the address", async ({page}) => {
        await openConsole(page, WALLET);
        await expect(page.getByTestId("no-console")).toContainText("governed by its voters");
    });

    test("without a wallet the console waits for one", async ({page, network}) => {
        adminRun(network);
        await page.goto("/dao/2/admin");
        await expect(page.getByTestId("admin-needs-wallet")).toBeVisible();
        await expect(page.getByTestId("admin-console")).toHaveCount(0);
    });
});

test.describe("run actions as the DAO", () => {
    test("pays from the treasury: every message reviewed, then the signature is refused here and nothing is sent", async ({page, network}) => {
        adminRun(network);
        await openConsole(page, WALLET);

        await expect(page.getByTestId("execute-submit")).toBeDisabled();
        await page.getByTestId("add-action").click();
        await page.getByTestId("add-pay").click();
        await expect(page.getByTestId("pay-held")).toContainText("TBZE");
        await page.getByTestId("pay-to").fill(STRANGER);
        await page.getByTestId("pay-amount").fill("12.5");

        const review = page.getByTestId("execute-review");
        await expect(review).toContainText("Send 12.5 TBZE from the DAO");
        await expect(review).toContainText("Every message is signed by the DAO account");
        await expect(page.getByTestId("execute-outer")).toContainText("MsgAdminExecute");
        await expect(page.getByTestId("execute-sign")).toContainText("Signed by your wallet");
        await expect(page.getByTestId("execute-submit")).toBeEnabled();

        await page.getByTestId("execute-submit").click();
        await expect(page.getByTestId("action-error")).toBeVisible({timeout: 20_000});
        await expect(page.getByTestId("action-sent")).toHaveCount(0);
        await expect(page.getByTestId("action-unconfirmed")).toHaveCount(0);
    });

    test("more than the treasury holds, and a message the chain refuses an admin, cannot be sent", async ({page, network}) => {
        adminRun(network);
        await openConsole(page, WALLET);

        await page.getByTestId("add-action").click();
        await page.getByTestId("add-pay").click();
        await page.getByTestId("pay-to").fill(STRANGER);
        await page.getByTestId("pay-amount").fill("5000.000001");
        await expect(page.getByTestId("execute-problem")).toContainText("holds less than this");
        await expect(page.getByTestId("execute-submit")).toBeDisabled();

        await page.getByTestId("add-action").click();
        await page.getByTestId("add-custom").click();
        await page.getByTestId("custom-json").fill(JSON.stringify({"@type": "/cosmos.authz.v1beta1.MsgExec", grantee: "bze1qpnpkg3fxqmnu32v2ddxz6r0we7cfzuju9qjws", msgs: []}));
        await expect(page.getByTestId("action-error").last()).toContainText("1133");
        await expect(page.getByTestId("execute-submit")).toBeDisabled();
    });
});

test.describe("the handover", () => {
    test("nominate: the nominee is checked, the message shown, and the signature is refused here", async ({page, network}) => {
        adminRun(network);
        await openConsole(page, WALLET);

        await page.getByTestId("nominee").fill("cosmos1nope");
        await expect(page.getByTestId("nominate-problem")).toContainText("not a valid BeeZee address");
        await page.getByTestId("nominee").fill(WALLET);
        await expect(page.getByTestId("nominate-problem")).toContainText("already the admin");
        await expect(page.getByTestId("nominate-submit")).toBeDisabled();

        await page.getByTestId("nominee").fill(NOMINEE);
        await expect(page.getByTestId("nominate-panel")).toContainText("Nominate a new admin for DAO 2 (they have to accept)");
        await page.getByTestId("nominate-submit").click();
        await expect(page.getByTestId("action-error")).toBeVisible({timeout: 20_000});
    });

    test("with a nomination pending it can be withdrawn, and neither a new one nor the handover to voters is offered", async ({page, network}) => {
        adminRun(network, {pending_admin: NOMINEE, pending_admin_seq: "1"});
        await openConsole(page, WALLET);

        await expect(page.getByTestId("withdraw-nominee")).toContainText("bze1");
        await expect(page.getByTestId("nominate-pending")).toContainText("1112");
        await expect(page.getByTestId("handover-blocked")).toContainText("1112");
        await page.getByTestId("withdraw-submit").click();
        await expect(page.getByTestId("action-error")).toBeVisible({timeout: 20_000});
    });

    test("hand the DAO to its voters: a strong confirmation first, then the signature is refused here", async ({page, network}) => {
        adminRun(network);
        await openConsole(page, WALLET);

        await expect(page.getByTestId("handover-panel")).toContainText("you cannot undo it");
        await expect(page.getByTestId("handover-voters")).toContainText("2 members");
        await expect(page.getByTestId("handover-submit")).toBeDisabled();
        await page.getByTestId("handover-understood").check();
        await page.getByTestId("handover-confirm").fill("Founder");
        await expect(page.getByTestId("handover-submit")).toBeDisabled();
        await page.getByTestId("handover-confirm").fill("Founders");
        await expect(page.getByTestId("handover-submit")).toBeEnabled();
        await page.getByTestId("handover-submit").click();
        await expect(page.getByTestId("action-error")).toBeVisible({timeout: 20_000});
    });

    test("a DAO with no voters cannot be handed over", async ({page, network}) => {
        adminRun(network, {members: []});
        await openConsole(page, WALLET);
        await expect(page.getByTestId("handover-blocked")).toContainText("no voters to hand it to");
        await expect(page.getByTestId("handover-submit")).toHaveCount(0);
    });
});

test.describe("accept a nomination", () => {
    const nominated = (network: MockNetwork, nominee: string, over: Record<string, unknown> = {}) => {
        network.use("lcd", {path: "/bze/dao/dao/4", status: 200, body: {dao: {...daoFour.body.dao, pending_admin: nominee, ...over}}});
        network.use("lcd", {path: `/bze/dao/dao_by_address/${nominee}`, status: 404, body: NOT_A_DAO});
        if (nominee !== WALLET) asWallet(network, nominee);
    };

    test("the nominee finds the link on the DAO page, sees what they take over, then the signature is refused here", async ({page, network}) => {
        nominated(network, WALLET);
        await installFakeKeplr(page, WALLET);
        await page.goto("/dao/4");
        await connectWallet(page);
        await page.getByTestId("admin-console-link").click();

        await expect(page.getByTestId("admin-console")).toHaveAttribute("data-role", "nominee");
        await expect(page.getByTestId("accept-panel")).toContainText("Stakers club nominated your wallet");
        await expect(page.getByTestId("treasury-panel")).toBeVisible();
        await expect(page.getByTestId("rules-panel")).toBeVisible();
        await expect(page.getByTestId("execute-panel")).toHaveCount(0);

        await expect(page.getByTestId("accept-check")).toContainText("Accept the admin nomination of DAO 4");
        await page.getByTestId("accept-submit").click();
        await expect(page.getByTestId("action-error")).toBeVisible({timeout: 20_000});
    });

    test("a nomination that went stale says so instead of offering the button", async ({page, network}) => {
        nominated(network, NOMINEE, {admin_seq: "9", pending_admin_seq: "2"});
        await openConsole(page, NOMINEE, "4");

        await expect(page.getByTestId("accept-stale")).toHaveText("This nomination is out of date; the current admin must withdraw it and nominate again.");
        await expect(page.getByTestId("accept-submit")).toHaveCount(0);
    });

    test("a nomination that cannot be checked is not offered either, and can be checked again", async ({page, network}) => {
        nominated(network, NOMINEE);
        network.use("lcd", {path: "/bze/dao/dao_controller/4", status: 500, body: {code: 2, message: "internal", details: []}});
        await openConsole(page, NOMINEE, "4");

        await expect(page.getByTestId("accept-unreadable")).toBeVisible();
        await expect(page.getByTestId("accept-submit")).toHaveCount(0);

        network.use("lcd", {...fixture("dao.controller.4.json"), status: 200});
        await page.getByTestId("accept-retry").click();
        await expect(page.getByTestId("accept-submit")).toBeVisible();
    });

    test("someone who is not the nominee has no console on a DAO with a nomination", async ({page, network}) => {
        nominated(network, NOMINEE);
        await openConsole(page, WALLET, "4");
        await expect(page.getByTestId("no-console")).toBeVisible();
    });
});

test("nominate, then accept as the nominee: two wallets, each stopping before the signature", async ({page, network, context}) => {
    adminRun(network);
    asWallet(network, NOMINEE);
    await openConsole(page, WALLET);
    await page.getByTestId("nominee").fill(NOMINEE);
    await expect(page.getByTestId("nominate-submit")).toBeEnabled();

    // the chain after the nomination: the e2e wallet is still the admin, the nominee has been named
    adminRun(network, {pending_admin: NOMINEE, pending_admin_seq: "2", admin_seq: "1"});
    const nomineePage = await context.newPage();
    // the same browser context shares localStorage: the second wallet must not inherit the first one's session
    await nomineePage.addInitScript(() => window.localStorage.clear());
    await openConsole(nomineePage, NOMINEE);
    await expect(nomineePage.getByTestId("admin-console")).toHaveAttribute("data-role", "nominee");
    await expect(nomineePage.getByTestId("accept-submit")).toBeVisible();
    await nomineePage.getByTestId("accept-submit").click();
    await expect(nomineePage.getByTestId("action-error")).toBeVisible({timeout: 20_000});
});
