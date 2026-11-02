# @bze/bze-ui-kit

Shared hooks, utilities, query clients, services, UI components, and types for BZE ecosystem frontend apps.

## Installation

```sh
npm install @bze/bze-ui-kit
```

### Peer dependencies

The consuming app must have these installed (they are **not** bundled):

```sh
npm install @bze/bzejs @chakra-ui/react bignumber.js chain-registry \
  @chain-registry/types @chain-registry/utils \
  @interchain-kit/core @interchain-kit/react \
  @interchainjs/cosmos @interchainjs/encoding \
  next-themes react react-dom react-icons
```

## Usage

```ts
import {
  // Configuration — call these early in your app (both optional)
  setStorageKeyVersion,
  setDefaultTxMemo,

  // Utils
  toBigNumber, prettyAmount, createMarketId, formatUsdAmount,

  // Query clients
  getMarkets, getLiquidityPools, getAddressBalances, getBZEUSDPrice,

  // Hooks
  useAssets, useBalances, useMarkets, useLiquidityPools,
  useWalletHealthCheck,

  // Context (provide your own AssetsProvider)
  AssetsContext,

  // Types
  type Asset, type Market, type Balance,
} from '@bze/bze-ui-kit';
```

### App initialization

Each app must configure the library at startup:

```ts
// In your app's entry point (e.g., layout.tsx)
import { setStorageKeyVersion, setDefaultTxMemo } from '@bze/bze-ui-kit';

// Set a unique storage prefix to avoid localStorage collisions between apps
setStorageKeyVersion('3');  // dex uses '3', burner uses '2'

// Optional — transaction memo defaults to NEXT_PUBLIC_APP_NAME if set.
// Only needed if you want a value different from the app name env var.
setDefaultTxMemo('dex.getbze.com');
```

### AssetsProvider

The library exports `AssetsContext` and `AssetsContextType` but each app implements its own `AssetsProvider`. This is because dex and burner have different app-specific state on top of the shared base.

### Wallet health check

Call `useWalletHealthCheck()` in a top-level always-mounted component (e.g. `BlockchainListenerWrapper`) to proactively detect and clear stale wallet state restored from localStorage (e.g. extension locked after leaving the page for hours):

```ts
import { useWalletHealthCheck } from '@bze/bze-ui-kit';

export function BlockchainListenerWrapper() {
  useWalletHealthCheck();
  // ...
}
```

### Blockchain event subscriptions

Use `getChainFeed` to subscribe to CometBFT events through one chain feed per tab (the WebSocket connects lazily on the first subscribe):

```ts
import { getChainFeed, getSettings } from '@bze/bze-ui-kit';

const feed = getChainFeed(getSettings().endpoints.rpcEndpoint);

// subscribe is synchronous and returns the unsubscribe function
const unsubscribe = feed.subscribe("tm.event='NewBlock'", (result) => { /* handle result.data.value */ });

// 'connecting' | 'live' | 'down' — `live` only while notifications are arriving
const stopStatus = feed.onStatus((status) => { /* poll while status !== 'live' */ });
```

The feed shares one server subscription per query, resubscribes everything on every (re)connect, reconnects forever with capped backoff (1 s up to 30 s) and reports `down` when the socket closes, the node refuses or cancels a subscription, or no block arrives for 30 s. `createChainFeed` takes the socket factory and timers as dependencies (used by the unit tests).

### Event helper functions

Use these to filter CometBFT events in your blockchain listener:

```ts
import {
  isAddressTransfer, isBurnEvent, isCoinbaseEvent, isEpochStartEvent,
  isOrderBookEvent, isOrderExecutedEvent, isSwapEvent,
  getMintedAmount, getEventMarketId, getEventKeyValue,
} from '@bze/bze-ui-kit';
```

## What's included

| Module | Description |
|--------|-------------|
| `types/` | TypeScript interfaces for assets, balances, markets, pools, staking, IBC, events, settings, burn, block |
| `utils/` | Pure functions: amount math, denom helpers, formatting, address validation, staking APR, chart periods, event filters |
| `constants/` | Chain config, RPC/REST endpoints, asset lists, keplr fallbacks, testnet, ecosystem navigation |
| `storage/` | localStorage wrapper with TTL + app settings persistence |
| `service/` | AmmRouter (Dijkstra swap routing), BlockchainEventManager (pub-sub), assets_factory, keplr suggest chain |
| `query/` | REST clients for bank, staking, markets, liquidity pools, epochs, IBC, burner, raffle, block, module, rewards, aggregator, prices |
| `hooks/` | React hooks: useAssets, useBalances, useMarkets, useLiquidityPools, useLiquidityPool, usePrices, useEpochs, useSigningClient, useWalletHealthCheck, useSettings, useFeeTokens, useAssetsValue, useConnectionType, useToast, useSDKTx/useBZETx/useIBCTx |
| `contexts/` | Base `AssetsContextType` interface + `AssetsContext` React context |
| `components/` | Sidebar, WalletSidebarContent, SettingsSidebarContent, SettingsToggle, Toaster, HighlightText |

## Required environment variables

The library reads these `NEXT_PUBLIC_*` env vars at build time (inlined by Next.js). The consuming app must define them in its `.env` file.

### Chain configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `NEXT_PUBLIC_CHAIN_ID` | `beezee-1` | Chain ID |
| `NEXT_PUBLIC_CHAIN_NAME` | `beezee` | Chain name (must match chain-registry) |
| `NEXT_PUBLIC_CHAIN_IS_TESTNET` | `false` | Set to `true` or `1` for testnet |
| `NEXT_PUBLIC_CHAIN_ADDRESS_PREFIX` | `bze` | Bech32 address prefix |
| `NEXT_PUBLIC_CHAIN_NATIVE_ASSET_DENOM` | `ubze` | Native staking/fee denom |
| `NEXT_PUBLIC_USDC_IBC_DENOM` | _(empty)_ | Denom of the USD price anchor on BZE (pinned to $1). Apps price BZE from the BZE/anchor **market**, so that market must exist (with trades) before the anchor is switched |
| `NEXT_PUBLIC_EXPLORER_URL` | `https://explorer.getbze.com` | BZE Scan base URL (no chain slug); links are built with `getExplorerTxURL` / `getExplorerAccountURL` / `getExplorerValidatorURL` / `getExplorerBlockURL` |
| `NEXT_PUBLIC_WALLET_CHAINS_NAMES` | _(auto)_ | Comma-separated chain names for wallet connection |
| `NEXT_PUBLIC_LOCKER_ADDRESS` | `bze1pc5zjcvhx3e8l305zjl72grytfa30r5mdypmw4` | Locker module address |
| `NEXT_PUBLIC_APP_NAME` | `BZE` | Display name and default transaction memo |
| `NEXT_PUBLIC_GAS_MULTIPLIER` | `1.5` | Multiplier applied to simulated gas estimates |

### BZE endpoints

| Env var | Default | Description |
|---------|---------|-------------|
| `NEXT_PUBLIC_REST_URL` | _(empty)_ | Default BZE REST endpoint |
| `NEXT_PUBLIC_RPC_URL` | _(empty)_ | Default BZE RPC endpoint |
| `NEXT_PUBLIC_REST_ENDPOINT` | _(empty)_ | User-configurable REST endpoint (settings default) |
| `NEXT_PUBLIC_RPC_ENDPOINT` | _(empty)_ | User-configurable RPC/WebSocket endpoint (settings default) |
| `NEXT_PUBLIC_AGG_API_HOST` | `https://getbze.com` | Aggregator API host for prices/tickers |

### IBC chain endpoints

| Env var | Description |
|---------|-------------|
| `NEXT_PUBLIC_RPC_URL_ARCHWAY` | Archway RPC |
| `NEXT_PUBLIC_RPC_URL_OSMOSIS` | Osmosis RPC |
| `NEXT_PUBLIC_RPC_URL_NOBLE` | Noble RPC |
| `NEXT_PUBLIC_RPC_URL_JACKAL` | Jackal RPC |
| `NEXT_PUBLIC_RPC_URL_FLIX` | OmniFlix RPC |
| `NEXT_PUBLIC_RPC_URL_ATOMONE` | AtomOne RPC |
| `NEXT_PUBLIC_RPC_URL_INJECTIVE` | Injective RPC |
| `NEXT_PUBLIC_REST_URL_ARCHWAY` | Archway REST |
| `NEXT_PUBLIC_REST_URL_OSMOSIS` | Osmosis REST |
| `NEXT_PUBLIC_REST_URL_NOBLE` | Noble REST |
| `NEXT_PUBLIC_REST_URL_JACKAL` | Jackal REST |
| `NEXT_PUBLIC_REST_URL_FLIX` | OmniFlix REST |
| `NEXT_PUBLIC_REST_URL_ATOMONE` | AtomOne REST |
| `NEXT_PUBLIC_REST_URL_INJECTIVE` | Injective REST |

### Ecosystem navigation

| Env var | Default | Description |
|---------|---------|-------------|
| `NEXT_PUBLIC_ECOSYSTEM_EXCLUDED` | _(empty)_ | Comma-separated keys to hide (e.g. `staking,factory`). Valid: `website`, `dex`, `staking`, `burner`, `factory`, `communities`, `explorer` |
| `NEXT_PUBLIC_ECOSYSTEM_LINK_{KEY}` | _(per app)_ | Override URL for an app (e.g. `NEXT_PUBLIC_ECOSYSTEM_LINK_WEBSITE`) |
| `NEXT_PUBLIC_ECOSYSTEM_LABEL_{KEY}` | _(per app)_ | Override display label (e.g. `NEXT_PUBLIC_ECOSYSTEM_LABEL_DEX`) |

The Explorer entry links `NEXT_PUBLIC_EXPLORER_URL` unless `NEXT_PUBLIC_ECOSYSTEM_LINK_EXPLORER` overrides it.

### Links to other BZE apps

The navbar's **Apps** menu is `AppsMenu` (the entries come from `getEcosystemApps()`). Wherever a screen links another BZE app, use one of these two, never a plain, outlined or filled button, so every app looks and reads the same and the link never competes with the page's own actions:

- `AppLink({ app, href, children })` — ghost (no border, no fill): the app's icon, the app's name in its accent, an external-link mark, new tab. Used everywhere: in sentences, link rows, cards, success screens and dialogs.
- `AppIconButton({ app, href, 'aria-label' })` — the same, icon only, for rows with no room for a label (tx lists, hashes).

Wording: the label is the app's name only ("Explorer", "DEX", "Staking", "Burner", "Communities"), also for a transaction on the Explorer; the surrounding heading or text says what the link is for. Toasts are not screens: the tx toast keeps its "View on Explorer" action. The icons (`AppIcon`) are copied from the branding repo `bze-alphateam/Official-BZEdge-Graphics` (`beezee/apps/<app>/icon/svg/`) into `src/components/app-identity/icon-data.ts`; the accents are `appIdentity` in `src/constants/app-identity.ts`.

### AtomOne validator (dex-only)

| Env var | Default | Description |
|---------|---------|-------------|
| `NEXT_PUBLIC_ATONE_VALIDATOR_SUPPORTED_DENOMS` | _(empty)_ | Comma-separated denoms supported by BZE validator |
| `NEXT_PUBLIC_ATONE_VALIDATOR_PAGE_URL` | _(empty)_ | URL to the validator page |

## What stays app-specific

These are **not** in the library — each app keeps its own:

- **useBlockchainListener** — different WebSocket event subscriptions per app; built on top of `getChainFeed` from the lib
- **useNavigation** — completely different route structures
- **AssetsProvider** (`contexts/assets_context.tsx`) — each app extends the shared base `AssetsContextType` with app-specific state
- **Burner-only**: `useBurnerContext`, `useBurningHistory`, `useNextBurning`, `useRaffles`
- **Dex-only**: `useLockedLiquidity`, `useNativeStakingData`, `useRewardsStakingData`

## Development

```sh
# Install dependencies
npm install

# Build (CJS + ESM + type declarations)
npm run build

# Watch mode for development
npm run dev

# Type-check without emitting
npm run lint
```

## Build & Publish to npm

### Prerequisites

Add a publish token to `~/.npmrc` so `npm publish` never prompts for login:

```sh
echo "//registry.npmjs.org/:_authToken=YOUR_TOKEN" >> ~/.npmrc
```

Generate the token at npmjs.com → your avatar → Access Tokens → Generate New Token → Classic → Publish.

### Steps

```sh
# 1. Bump the version in package.json, then:
npm run build && npm publish
```

## License

MIT
