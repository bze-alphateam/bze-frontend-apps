# BZE DEX (dex.getbze.com)

Next.js decentralized exchange frontend for the BeeZee blockchain. React 19, Chakra UI v3, Recharts.

> Commands, env vars, patches, deploy: the **repo root README.md** owns all of that. This file is architecture only.

## Architecture

All shared code (hooks, utils, types, constants, query clients, services, storage, UI components) comes from `@bze/bze-ui-kit`. This app only contains DEX-specific logic and UI components.

### What's local (app-specific)

```
src/
  app/              # Next.js pages (swap, exchange, pools, staking, assets)
  components/       # DEX-specific UI components (trading, staking, navigation, token logos)
  contexts/
    assets_context.tsx  # DEX AssetsProvider — extends lib's base AssetsContextType
  hooks/
    useNavigation.tsx          # DEX route helpers (toMarketPage, toExchangePage, toLpPage, etc.)
    useBlockchainListener.tsx  # WebSocket event subscriptions (orders, swaps, supply changes)
    useLockedLiquidity.tsx     # Locked LP token queries for pool details
    useNativeStakingData.tsx   # Validator delegation and staking data
    useRewardsStakingData.tsx  # Rewards staking program data
```

### Look (Hive Glow)

- **Swap is the AMM, Exchange is the order book**, and every surface says which: `components/ui/trading/venue.tsx` has the AMM / ORDER BOOK tags, the filled (Swap) and outlined (Exchange) tiles and the "Liquidity pools · AMM" / "Order book · limit orders" lines.
- Trade sides and price moves use the data colours `hg.up` / `hg.down` (`trading/badges.tsx`: `ChangePill`, `SideBadge`, `PriceImpactBadge` green ≤ 0.5 %, amber > 0.5 %, red > 1 %), never the app colour. Market History keeps its old colouring (buy trades red, sell trades green).
- The chart canvas cannot read CSS tokens, so `trading/chart.tsx` takes its colours from ui-kit's exported token values (`HIVE_GLOW_DARK` / `HIVE_GLOW_LIGHT`, `HIVE_GLOW_APPS.dex`).
- The market page's cards, book rows, order forms and small tables are in `trading/market-parts.tsx`.
- **Reward names**: the chain's rewards staking is a **"Simple reward"** and its denom rewards a **"Compounded reward"** in every UI string; code identifiers keep the chain names. In UI copy each one is a "Reward", never a "program".
- `/staking` is two compact tables (`staking/staking-table.tsx`) over one row model (`lib/staking-list.ts`: native staking, simple and compounded rewards as `StakingRow`s, with the filters, the sort, native → verified by APR → the rest, and 25-row numbered pages). **Your positions** has the DEX gradient edge, a summary and one big Claim, which opens the picker (`staking/claim-picker-modal.tsx`). The picker claims every reward the viewer selects in one transaction: one message per validator for native staking, one per reward otherwise. Each position row has Manage, which opens that kind's own dialog. **Explore** has the search, the kind chips (All / Simple / Compounded / LP) and Verified only (on by default) / Show finished (off). Native staking hides while a search is active, and `?search=` prefills the search. Every row shows the same spec line under the name ("Unlock 7 days · Min 100 BZE · Running"). The kind tag (`RewardKindTag`) is the DEX gradient for Native, a neutral outline for Simple and info blue for Compounded. Stake / Claim / Manage are the DEX soft button; Unlock / Unstake / Exit are the neutral outline with the amber lock-open icon (`staking/rewards-staking-buttons.tsx`). Each dialog's confirm is the one gradient button.
- Dialogs use `components/ui/dialog.tsx` (`DexDialog`, the ui-kit fee details frame). Inner pages start with `layout/inner-hero.tsx`; the pool forms' fields, slippage, tabs and tiles are in `pools/pool-parts.tsx`, the pool APR chip (green > 15 %, amber > 10 %, else DEX) in `pools/apr-chip.tsx`.
- The header's active item follows `lib/nav-active.ts`: a detail page (`/exchange/market`, `/pools/details`, `/assets/details`) highlights its parent.

### What comes from @bze/bze-ui-kit

Everything else: `useAssets`, `useBalances`, `useMarkets`, `useLiquidityPools`, `useLiquidityPool`, `useEpochs`, `useSettings`, `useToast`, `useSDKTx`, `useAssetPrice`, `useAssetsValue`, all utils, all types, all constants, all query clients, all services, sidebar components, toaster, HighlightText.

## App initialization (layout.tsx)

```tsx
import { setStorageKeyVersion, setDefaultTxMemo, Toaster } from '@bze/bze-ui-kit';
setStorageKeyVersion('3');
setDefaultTxMemo('dex.getbze.com');
```
