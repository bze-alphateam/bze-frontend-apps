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

Unless a row says otherwise, every file was recorded on 2026-10-11 with `node e2e/support/record-fixture.mjs '<mocked url>' <name>`, which fetches `<source>` once. LCD fixtures come from the testnet REST node `https://testnet.getbze.com` (chain `bzetestnet-3`). Aggregator fixtures come from `https://getbze.com`, the aggregator the testnet apps use (it indexes mainnet).

## Testnet data the specs rely on

- Supply holds four factory tokens, all created by `bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l`: `noadmin` (NoAdminToken), `testusd` (USDollar, the app's USDC), `uxfct` (XFactor) and `vidulum` (Vidulum). It also holds `ubze`, one IBC token and three LP shares.
- `noadmin` is the only token with a brand kit and a holders pool (denom reward). The holders pool has two prizes, `noadmin` and `vidulum`.
- The one reward program (SR) stakes `vidulum` and is finished (15 of 15 payouts), so no token counts as having an active one.
- Pools: `noadmin`/`testusd`, `testusd`/`ubze` and the IBC token/`ubze`. `uxfct` and `vidulum` are not traded.
- The other three tokens answer 404 (gRPC NotFound) for branding and denom reward, exactly as the chain does.

## Files

| File | Request | Notes |
|---|---|---|
| `lcd/bank.supply.json` | total supply, limit 200 | listed by the directory |
| `lcd/bank.denoms_metadata.json` | denom metadata, limit 200 | token names and tickers |
| `lcd/bank.spendable_balances.burner.json` | burner module balances | "next burn" |
| `lcd/burner.params.json` | burner params | burn period |
| `lcd/burner.all_burned_coins.json` | burn history | **trimmed**: `burnedCoins` emptied, so no burn needs a block-time lookup on the RPC |
| `lcd/epochs.epochs.json` | epochs | |
| `lcd/tradebin.all_liquidity_pools.json` | pools, limit 1000 | |
| `lcd/tradebin.all_markets.json` | order-book markets, limit 1000 | |
| `lcd/tradebin.market_history.ulmn_testusd.json` | trade history of the one order-book market (ULMN/TUSDC), limit 50, reversed | **trimmed** to the latest trade; the price calculation reads it when a token has no pool or ticker price, so whether it is requested depends on timing |
| `lcd/tradebin.halted_denoms.json` | halted denoms, limit 500 | empty on testnet |
| `lcd/tradebin.params.json` | tradebin params | fee-token eligibility |
| `lcd/txfeecollector.params.json` | txfeecollector params | |
| `lcd/rewards.all_staking_rewards.json` | staking rewards (SRs), limit 1000, reversed | |
| `lcd/rewards.all_denom_rewards.json` | every holders pool, limit 500 | the directory's "Holders pool" badge and Staking rewards filter |
| `lcd/rewards.denom_reward.<token>.json` | holders pool of each token | 200 for `noadmin`, 404 for the rest |
| `lcd/rewards.denom_reward_schedules.noadmin.json` | holders pool schedules, limit 500 | |
| `lcd/rewards.denom_reward_prizes.noadmin.json` | holders pool prizes | |
| `lcd/tokenfactory.all_denom_branding.json` | every brand kit, limit 500 | the directory's card colours (only `noadmin` has one) |
| `lcd/tokenfactory.denom_branding.<token>.json` | brand kit of each token | 200 for `noadmin`, 404 for the rest |
| `lcd/ibc.denom_trace.ulmn.json`, `lcd/ibc.channel-0.json`, `lcd/ibc.connection-0.json`, `lcd/ibc.client_state.07-tendermint-0.json` | IBC trace of the testnet IBC token | the asset list resolves its origin chain |
| `agg/dex.tickers.json` | `/api/dex/tickers` | **trimmed** to the first 3 tickers (mainnet markets, unused by testnet denoms) |
| `agg/prices.json` | `/api/prices` | BZE/USD price |
