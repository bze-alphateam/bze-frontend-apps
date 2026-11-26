# e2e fixtures

One JSON file per request the e2e build makes to a mocked host, in the envelope the communities suite documents (`apps/communities/e2e/fixtures/README.md`): `method`, `path` and `query` are the key the mock matches, `status` and `body` the answer. `lcd/` answers `https://lcd.e2e.test`, `agg/` `https://agg.e2e.test`, and `scan/` the app's own `/api/scan/*` route (BZE Scan).

## Origin

- The shell fixtures (bank supply and metadata, epochs, IBC, tradebin, txfeecollector, staking and denom rewards, aggregator tickers and prices) are copies of the communities suite's recordings: the app's assets provider asks for the same.
- `lcd/dao.params.json` is recorded from testnet (chain v8.3.0).
- **Hand-written, not recorded** (testnet has no DAOs yet, and the BFE-368 Scan routes are not deployed): every file in `scan/`, and `lcd/dao.daos*.json`, `lcd/rewards.*.wallet.json`. They follow the Scan DTOs of BFE-353 / BFE-354 / BFE-368 and the chain's REST shape. When BFE-368 is on testnet, re-record them with `e2e/support/record-fixture.mjs` and diff.

## The data the specs rely on

Four DAOs, ids 4 to 1, newest first (Scan's page size in the app is 20; the first page is cut at three with a cursor so the specs can page):

| id | name | type | owner | open proposals |
|---|---|---|---|---|
| 4 | Stakers club | stake | admin-run | 2 |
| 3 | Treasury council | static list | admin-run (admin = the e2e wallet) | 0 |
| 2 | Founders | static list | self-owned | 1 |
| 1 | Beekeepers | stake | admin-run (admin = the e2e wallet) | 0 |

The e2e wallet `bze1qqqpkg3fxqmnu32v2ddxz6r0we7cfzuju395lw` administers DAOs 3 and 1, is a member of 3 and 2, and stakes in staking reward `000000000017`, which DAO 4's electorate uses.

| File | Request |
|---|---|
| `scan/daos.probe-filters.json` | the probe: an invalid `member` address answers 400 on a Scan that has the BFE-368 filters |
| `scan/daos.page-1.json`, `daos.page-2.json` | the unfiltered list, 20 per page, cursor `c1` |
| `scan/daos.type-stake.json`, `daos.search-club.json` | `type=stake`, `q=club` |
| `scan/daos.member.wallet.json`, `daos.source.wallet.json` | `member=<wallet>`, `source=sr/000000000017` |
| `scan/dao-proposals.voting.json` | the open proposals feed (`status=voting`, 10) |
| `lcd/tradebin.market_history.ulmn_testusd.json` | trade history of the one order-book market (copied from the communities suite; the price calculation asks for it depending on timing) |
| `lcd/bank.spendable_balances.wallet.json` | the e2e wallet's balances (none) |
| `lcd/dao.params.json` | x/dao params (creation fee 50000 BZE) |
| `lcd/dao.daos_by_admin.wallet.json` | DAOs administered by the wallet |
| `lcd/dao.daos.fallback.json` | the chain's DAO list, newest first (the Scan-down fallback) |
| `lcd/rewards.staking_reward_participant.wallet.json`, `rewards.denom_reward_participations.wallet.json` | the wallet's x/rewards positions |
