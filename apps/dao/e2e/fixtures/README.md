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
| `lcd/rewards.all_staking_rewards.dao_sources.json` | hand-written: the staking rewards the create flow's source picker lists (one short lock, one other token) |

## The DAO page (BFE-372)

Hand-written as well (testnet still has no DAO): `lcd/dao.dao.{2,4,9}.json` (9 answers the chain's NotFound), `dao.controller.*`, `dao.dao_by_address.*` (404: not a DAO), `dao.proposals.{2,4}`, `dao.voting_power.*.wallet`, `bank.spendable_balances.dao{2,4}`, `rewards.staking_reward.17`, `rewards.staking_reward_participant.dao4` (the DAO account's own stake, left out of the total); `scan/daos.{2,4}` (creation info), `daos.2.history` + `daos.2.history.page2` (cursor `c1`), `dao-votes.wallet` (a vote in DAO 2 and one in DAO 4, to prove the page keeps only its own). DAO 2 "Founders" is a self-owned static list with the e2e wallet and one other member; DAO 4 "Stakers club" is a stake DAO (staking reward 17) run by an outside account that nominated DAO 1's account as successor. Re-record them (and the ui-kit `dao.fixtures.ts`, ticket item 11) once testnet has DAOs on v8.3.0.

## The proposal pages (BFE-373)

Hand-written as well: `lcd/dao.proposal.{8,9,10}` (8 a static-list proposal of DAO 2 in voting, 9 an expedited stake proposal of DAO 4 that can be settled early and carries four actions, 10 a passed proposal of DAO 4 whose actions failed, with a retry deadline), `dao.proposal.{11,99}` (the chain's NotFound: 11 is the cleaned-up proposal Scan still has), `dao.ballot.{8,9}.wallet` (a vote, and the NotFound of none), `dao.ballots.9` (the chain's ballots, read when Scan is down), `dao.proposals.4.active` (the Scan-down Active tab: both statuses in one request, newest first); `scan/dao-proposals.{8,9,10,11,99}` (the indexed proposal; 11 has `cleaned_height`, 99 is the NotFound), `dao-proposals.{8,9,10,11}.votes` and `.9.votes.yes` (the option filter), `daos.4.proposals.{voting,failed,finished}` (the DAO 4 tab; the finished list has a placeholder row without a status that the page leaves out). Re-record them when testnet has DAOs on v8.3.0.

## The self-management actions (BFE-376)

The composer reads a DAO's relations before it opens: `lcd/dao.daos_by_admin.{dao2,dao4}` (the DAOs the DAO account administers; a self-owned DAO lists itself, so DAO 2's answer carries DAO 2 and the composer leaves it out), `scan/daos.pending-admin.{dao2,dao4}` (Scan's `pending_admin` filter: nobody nominated them) and `lcd/rewards.denom_reward_participations.dao4` (the DAO account's own Denom Reward stake, read with the staking rewards for the voters action). Hand-written like the rest; a spec that needs a sub-DAO or a nomination answers these with `network.use`.
