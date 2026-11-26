import {readFileSync} from "node:fs";
import {join} from "node:path";
import {expect, test, type MockNetwork} from "./support/mock-network";
import {connectWallet as connect, installFakeKeplr} from "./support/fake-keplr";
import type {Page} from "@playwright/test";

// The actions on a proposal (BFE-374), against the same hand-written chain and Scan answers as
// proposal-page.spec.ts. The e2e wallet approves connections and refuses to sign, so what these specs
// drive is everything up to the signature: what is offered, the words before signing, the locks, and the
// refusal that comes back (no transaction is ever broadcast). The messages, the sign options and the
// flows after a signature are covered by the unit tests with an injected signer.
//
// The e2e wallet proposed proposals 8 (static list, voting, its ballot is YES), 9 (stake, expedited and
// settleable early) and 10 (passed, actions failed, retry window over by now).
const WALLET = "bze1qqqpkg3fxqmnu32v2ddxz6r0we7cfzuju395lw";

const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", "lcd", name), "utf8")) as {path: string; query?: Record<string, string>; status: number; body: {proposal: Record<string, unknown>} & Record<string, unknown>};

/** The chain's answer for proposal `id` with some of its fields changed. */
function chainProposal(network: MockNetwork, id: number, over: {proposal?: Record<string, unknown>; voting_ended?: boolean}) {
    const base = fixture(`dao.proposal.${id}.json`);
    network.use("lcd", {path: base.path, status: 200, body: {...base.body, ...(over.voting_ended === undefined ? {} : {voting_ended: over.voting_ended}), proposal: {...base.body.proposal, ...over.proposal}}});
}

/** Connects the wallet and makes sure its sidebar is closed, so it does not cover the buttons. */
async function connectWallet(page: Page) {
    await connect(page);
    const backdrop = page.getByTestId("sidebar-backdrop");
    if (await backdrop.count()) await backdrop.click({position: {x: 5, y: 5}});
    await expect(backdrop).toHaveCount(0);
}

/** The wallet holds some BZE, so the fee check lets it act. */
function fundWallet(network: MockNetwork) {
    network.use("lcd", {
        path: `/cosmos/bank/v1beta1/spendable_balances/${WALLET}`,
        status: 200,
        body: {balances: [{denom: "ubze", amount: "5000000"}], pagination: {next_key: null, total: "1"}},
    });
}

test.describe("vote and revote", () => {
    test("a member with a Yes ballot sees it marked, cannot repeat it, and gets the confirmation before signing", async ({page, network}) => {
        fundWallet(network);
        await installFakeKeplr(page, WALLET);
        await page.goto("/proposal/8");
        await connectWallet(page);

        await expect(page.getByTestId("action-vote")).toBeVisible();
        await expect(page.getByTestId("vote-weight-note")).toContainText("Your vote counts");
        await expect(page.getByTestId("vote-option-yes")).toBeDisabled();
        await expect(page.getByTestId("vote-option-yes")).toContainText("(your vote)");

        await page.getByTestId("vote-option-no").click();
        await expect(page.getByTestId("vote-confirm")).toHaveText("Change vote to No");
    });

    test("signing is refused by the e2e wallet: the reason is shown, nothing is sent, the vote can be tried again", async ({page, network}) => {
        fundWallet(network);
        await installFakeKeplr(page, WALLET);
        await page.goto("/proposal/8");
        await connectWallet(page);

        await page.getByTestId("vote-option-abstain").click();
        await page.getByTestId("vote-confirm").click();

        await expect(page.getByTestId("action-error")).toBeVisible({timeout: 20_000});
        await expect(page.getByTestId("action-unconfirmed")).toHaveCount(0);
        await expect(page.getByTestId("action-sent")).toHaveCount(0);
    });

    test("without a wallet the proposal says to connect one and offers no enabled vote", async ({page}) => {
        await page.goto("/proposal/8");

        await expect(page.getByTestId("actions-blocked")).toContainText("Connect a wallet");
        await expect(page.getByTestId("vote-option-no")).toBeDisabled();
    });

    test("a wallet without a balance is told why it cannot act", async ({page}) => {
        await installFakeKeplr(page, WALLET);
        await page.goto("/proposal/8");
        await connectWallet(page);

        await expect(page.getByTestId("actions-blocked")).toContainText("no balance to pay the network fee");
        await expect(page.getByTestId("vote-option-no")).toBeDisabled();
    });
});

test.describe("settle, retry and mark expired", () => {
    test("an expedited proposal that meets its bars is settled now, with the outcome said first", async ({page, network}) => {
        fundWallet(network);
        await installFakeKeplr(page, WALLET);
        await page.goto("/proposal/9");
        await connectWallet(page);

        await expect(page.getByTestId("settle-button")).toHaveText("Settle now");
        await expect(page.getByTestId("settle-note")).toContainText("settles now as passed");
        await expect(page.getByTestId("settle-button")).toBeEnabled();

        await page.getByTestId("settle-button").click();
        await expect(page.getByTestId("action-error")).toBeVisible({timeout: 20_000});
    });

    test("a proposal whose voting ended tells whether the tally passes", async ({page, network}) => {
        chainProposal(network, 8, {voting_ended: true});
        fundWallet(network);
        await installFakeKeplr(page, WALLET);
        await page.goto("/proposal/8");
        await connectWallet(page);

        await expect(page.getByTestId("settle-button")).toHaveText("Settle");
        await expect(page.getByTestId("settle-outcome")).toHaveAttribute("data-outcome", "pass");
        await expect(page.getByTestId("action-vote")).toHaveCount(0);
    });

    test("a failed execution past its retry deadline is marked expired, not retried", async ({page, network}) => {
        fundWallet(network);
        await installFakeKeplr(page, WALLET);
        await page.goto("/proposal/10");
        await connectWallet(page);

        await expect(page.getByTestId("settle-button")).toHaveText("Mark expired");
        await expect(page.getByTestId("settle-note")).toContainText("without running its actions");
    });

    test("a failed execution inside its retry window is offered as Retry with the last error", async ({page, network}) => {
        const base = fixture("dao.proposal.10.json");
        const inAYear = String(Math.floor(Date.now() / 1000) + 365 * 86_400);
        network.use("lcd", {path: base.path, status: 200, body: {...base.body, retry_deadline: inAYear}});
        fundWallet(network);
        await installFakeKeplr(page, WALLET);
        await page.goto("/proposal/10");
        await connectWallet(page);

        await expect(page.getByTestId("settle-button")).toHaveText("Retry");
        await expect(page.getByTestId("settle-note")).toContainText("empty treasury");
    });
});

test.describe("cancel", () => {
    test("the proposer reads what happens to the deposit before cancelling", async ({page, network}) => {
        fundWallet(network);
        await installFakeKeplr(page, WALLET);
        await page.goto("/proposal/9");
        await connectWallet(page);

        await page.getByTestId("cancel-button").click();
        await expect(page.getByTestId("cancel-notice")).toContainText("proposal cost is never refunded");
        await expect(page.getByTestId("cancel-confirm-button")).toBeVisible();
    });

    test("a wallet that did not propose has no cancel", async ({page, network}) => {
        chainProposal(network, 8, {proposal: {proposer: "bze1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq5xnn6"}});
        fundWallet(network);
        await installFakeKeplr(page, WALLET);
        await page.goto("/proposal/8");
        await connectWallet(page);

        await expect(page.getByTestId("action-vote")).toBeVisible();
        await expect(page.getByTestId("action-cancel")).toHaveCount(0);
    });
});

test.describe("clean up", () => {
    test("a finished proposal still on chain offers a low-key clean-up, not a vote or a settle", async ({page, network}) => {
        chainProposal(network, 8, {proposal: {status: "REJECTED"}});
        fundWallet(network);
        await installFakeKeplr(page, WALLET);
        await page.goto("/proposal/8");
        await connectWallet(page);

        await expect(page.getByTestId("cleanup-button")).toBeVisible();
        await expect(page.getByTestId("action-vote")).toHaveCount(0);
        await expect(page.getByTestId("action-settle")).toHaveCount(0);
    });

    test("an archived proposal has no actions at all", async ({page, network}) => {
        fundWallet(network);
        await installFakeKeplr(page, WALLET);
        await page.goto("/proposal/11");
        await connectWallet(page);

        await expect(page.getByTestId("proposal-archived")).toBeVisible();
        await expect(page.getByTestId("action-cleanup")).toHaveCount(0);
        await expect(page.getByTestId("action-settle")).toHaveCount(0);
    });
});
