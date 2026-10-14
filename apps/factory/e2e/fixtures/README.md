# e2e fixtures

One JSON file per request the e2e build makes to a mocked host. `lcd/` answers `https://lcd.e2e.test` and `agg/` answers `https://agg.e2e.test`. Each file is an envelope:

```json
{
  "source": "https://testnet.getbze.com/bze/burner/params",
  "recorded": "2026-10-11",
  "method": "GET",
  "path": "/bze/burner/params",
  "query": {},
  "status": 200,
  "body": {"params": {}}
}
```

`method`, `path` and `query` form the key the mock matches requests on. `status` and `body` are the answer. `source`, `recorded` and the optional `trimmed` field document where the answer came from and what was cut. `support/mock-network.ts` refuses to start when two files answer the same key.

Unless a row says otherwise, every file was recorded on 2026-10-11 (for the communities suite, `apps/communities/e2e/fixtures`, which makes the same ui-kit boot requests; copied in BFE-143) with `node e2e/support/record-fixture.mjs '<mocked url>' <name>`, which fetches `<source>` once. LCD fixtures come from the testnet REST node `https://testnet.getbze.com` (chain `bzetestnet-3`). Aggregator fixtures come from `https://getbze.com`, the aggregator the testnet apps use (it indexes mainnet).

## Testnet data the specs rely on

- Supply holds four factory tokens, all created by `bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l`: `noadmin` (NoAdminToken), `testusd` (USDollar, the app's USDC), `uxfct` (XFactor) and `vidulum` (Vidulum). It also holds `ubze`, one IBC token and three LP shares.
- Every creation fee (tokenfactory, tradebin and rewards params) is 25,000 TBZE (testnet's native ticker).
- `noadmin` is the only token with a denom reward, so `/denom-reward` lists one row. It has two prize tokens, `noadmin` and `vidulum`.
- The one staking reward (SR) stakes `vidulum` and is finished (15 of 15 payouts).
- Pools: `noadmin`/`testusd`, `testusd`/`ubze` and the IBC token/`ubze`.

## Files

| File | Request | Notes |
|---|---|---|
| `lcd/bank.supply.json` | total supply, limit 200 | the asset list |
| `lcd/bank.denoms_metadata.json` | denom metadata, limit 200 | token names and tickers |
| `lcd/bank.spendable_balances.burner.json` | burner module balances | |
| `lcd/burner.params.json` | burner params | |
| `lcd/burner.all_burned_coins.json` | burn history | **trimmed**: `burnedCoins` emptied, so no burn needs a block-time lookup on the RPC |
| `lcd/epochs.epochs.json` | epochs | |
| `lcd/tokenfactory.params.json` | tokenfactory params | `create_denom_fee`: the "Create Token" card's fee line and the `/token/new` fee (`token-new.spec.ts`). Recorded 2026-10-12 |
| `lcd/tradebin.params.json` | tradebin params | market / pool creation fee (`market-new.spec.ts`, `pool-new.spec.ts`), fee-token eligibility |
| `lcd/rewards.params.json` | rewards params | staking reward and denom reward fees and limits (the staking program fee of `reward-new.spec.ts`, the daily prize fee of `denom-reward-schedule.spec.ts`). Recorded 2026-10-12 |
| `lcd/tradebin.all_liquidity_pools.json` | pools, limit 1000 | the NOAD/TUSDC pool of `pool-add.spec.ts`, which also empties the list with `network.use`; the TUSDC/TBZE LP token of `reward-new.spec.ts` |
| `lcd/tradebin.all_markets.json` | order-book markets, limit 1000 | |
| `lcd/tradebin.market_history.ulmn_testusd.json` | trade history of the one order-book market (ULMN/TUSDC), limit 50, reversed | **trimmed** to the latest trade; the price calculation reads it when a token has no pool or ticker price, so whether it is requested depends on timing |
| `lcd/tradebin.halted_denoms.json` | halted denoms, limit 500 | empty on testnet |
| `lcd/txfeecollector.params.json` | txfeecollector params | |
| `lcd/rewards.all_staking_rewards.json` | staking rewards (SRs), limit 1000, reversed | |
| `lcd/rewards.all_denom_rewards.json` | every denom reward, limit 500 | the rows of `/denom-reward` |
| `lcd/rewards.denom_reward.noadmin.json` | the `noadmin` denom reward | the schedule form (`denom-reward-schedule.spec.ts`). Recorded 2026-10-14 |
| `lcd/rewards.denom_reward_prizes.noadmin.json` | prizes of the `noadmin` denom reward | its "Prize tokens" count; the schedule form's new-prize check |
| `lcd/rewards.denom_reward_schedules.noadmin.json` | schedules of the `noadmin` denom reward, limit 500 | its "Running schedules" count; the schedule form's extend mode (`000000000000`, 200 days) |
| `lcd/ibc.denom_trace.ulmn.json`, `lcd/ibc.channel-0.json`, `lcd/ibc.connection-0.json`, `lcd/ibc.client_state.07-tendermint-0.json` | IBC trace of the testnet IBC token | the asset list resolves its origin chain |
| `agg/dex.tickers.json` | `/api/dex/tickers` | **trimmed** to the first 3 tickers (mainnet markets, unused by testnet denoms) |
| `agg/prices.json` | `/api/prices` | BZE/USD price |
