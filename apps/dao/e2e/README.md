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
- Specs: `home.spec.ts` (list, filter, search, paging, open feed, explainer, navbar), `my-daos.spec.ts` (each reason, the Scan-without-filters case), `fallbacks.spec.ts` (v8.2 node, Scan down, Scan without the BFE-368 filters), `dao-page.spec.ts` (the page of a static-list and of a stake DAO, wallet and no wallet, history, not found, Scan down, v8.2 node).
- Later DAO stories add their specs and fixtures here.
- `proposal-page.spec.ts` (BFE-373): the proposal page: a static-list and a stake proposal in voting, an expedited one settleable early with its four actions, one whose actions failed (retry deadline), one the chain cleaned up (Archived, from Scan), not found, and Scan down. `dao-proposals.spec.ts`: the DAO page's Proposals tab (Active / Finished, Scan down).
- A fixture's `query` value can be an array for a repeated parameter, in the order the app sends it (the chain's `statuses=VOTING&statuses=EXECUTION_FAILED`).
- `proposal-actions.spec.ts` (BFE-374): the actions on a proposal (vote and revote, settle, retry / mark expired, cancel, clean up). The fake wallet refuses to sign, so a spec drives everything up to the signature and the refusal that comes back; the signed flows are unit-tested with an injected signer. A spec that needs to act funds the wallet with `network.use` (the shared fixture holds no balance) and reshapes the chain's proposal the same way.
