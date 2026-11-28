# DAO e2e tests

Playwright specs that drive a production build of the DAO app in Chromium, the same harness as the communities suite (`apps/communities/e2e/README.md` explains the network mock, the fixture envelope, recording and `network.use`). Every call to the chain, the aggregator, the RPC and BZE Scan (through the app's `/api/scan/*` route) is answered from `fixtures/`, so a run never touches a real service.

**They run in CI only**, in the `e2e-dao` workflow (`.github/workflows/e2e-dao.yml`), a check of its own next to `ci.yml`.

```bash
pnpm --filter @bze/bze-ui-kit build
pnpm --filter bze-dao e2e:build
pnpm --filter bze-dao exec playwright install --with-deps chromium
pnpm --filter bze-dao e2e
```

## Differences from the communities harness

- `playwright.config.ts` serves on port 3005 and `.env.e2e` points the Scan links at nothing real (the route answers from `fixtures/scan/`).
- **A wallet**: `support/fake-keplr.ts` installs a fake Keplr before the app loads (`installFakeKeplr`) and `connectWallet(page)` picks it in the header's wallet picker, as a user does. It approves connections and refuses to sign. `support/wallets.ts` makes valid `bze1…` addresses.
- Specs: `home.spec.ts` (the table, numbered paging with Back, type and search, empty states, phone cards, navbar with DAOs only and a 404 for `/create`), `my-daos.spec.ts` (the switch, the You column, each reason, the Scan-without-filters case), `fallbacks.spec.ts` (v8.2 node, Scan down with Prev / Next and Retry, Scan without the BFE-368 filters, Scan without totals), `dao-page.spec.ts` (the page of a static-list and of a stake DAO: the shared header with the Proposals counter, Who controls it with the governance rules on demand and the SubDAOs, the description's View all, the tabs in the URL (`?tab=proposals|history`, replaced, not pushed), wallet and no wallet, history (numbered pages in the URL, Prev / Next with an older Scan), not found, Scan down, v8.2 node, no sideways scroll on a phone).
- Later DAO stories add their specs and fixtures here.
- `proposal-page.spec.ts` (BFE-373): the proposal page: a static-list and a stake proposal in voting, an expedited one settleable early with its four actions, one whose actions failed (retry deadline), one the chain cleaned up (Archived, from Scan), not found, and Scan down. `dao-proposals.spec.ts`: the DAO page's Proposals tab (one table, the status filter with counts, active first with the rule, numbered pages in the URL, an older Scan with Prev / Next and its Active fallback, Scan down: All needs Scan, Active from the chain).
- A fixture's `query` value can be an array for a repeated parameter, in the order the app sends it (the chain's `statuses=VOTING&statuses=EXECUTION_FAILED`).
- `proposal-actions.spec.ts` (BFE-374): the actions on a proposal (vote and revote, settle, retry / mark expired, cancel, clean up). The fake wallet refuses to sign and the e2e chain has no RPC, so a spec drives everything up to the signature and the failure that comes back; the signed flows are unit-tested with an injected signer. A spec that needs to act funds the wallet with `network.use` (the shared fixture holds no balance) and reshapes the chain's proposal the same way.
- `propose.spec.ts` (BFE-375): the composer at `/dao/{id}/propose`: a text-only proposal, a treasury payment (review, warning past the balance, decimals), moving and removing actions, a custom message (signer check, decoded preview), the unsent draft (restore, discard, corrupt), who may propose (member, stranger, no wallet), the cost and deposit summary with the wallet's balance of a charging stake DAO (the wallet balance is overridden with `network.use`).
- `self-management.spec.ts` (BFE-376): the composer's DAO self-management actions: adding a member, renaming the DAO, nominating an admin, changing the rules (before and after), the sub-DAO actions with a sub-DAO answered through `network.use`, and the "Request to join" and "Leave" shortcut links (opened by URL: the DAO page no longer shows them). Every spec stops before signing: the fake wallet refuses to sign.
- `admin-console.spec.ts` (BFE-377): the admin console at `/dao/{id}/admin`, inside the DAO page's shell with its Admin console tab: who gets the tab and the console (the admin, the nominee, nobody else), paying from the treasury through an admin execute (reviewed in full, refused amounts and messages), nominate / withdraw / hand to the voters (checks and the strong confirmation), accepting a nomination (one card: the tick before the button; the stale card when a DAO above changed its admin; the accept card when the check cannot be made) and a nominate-then-accept run with two wallets. The nominee wallet is a second address whose wallet-scoped fixtures are the e2e wallet's, re-addressed by the spec. Every spec stops before signing: the fake wallet refuses. `my-daos.spec.ts` also checks the "Nominated" label (Scan names the candidates, the chain's pending admin confirms).
