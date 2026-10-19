# @bze/bze-ui-kit

Shared library for the BZE frontend apps (dex, burner, staking, factory, communities). Consumed via `workspace:*` — **never published to npm**; edit the source and apps pick it up.

> Commands, env vars, patches, deploy: the **repo root README.md** owns all of that. This file is architecture only.

## What this is

Shared code extracted from the apps: hooks, utilities, query clients, services, types, constants, storage helpers, and common UI components (sidebars, toaster, highlight text). All apps use Chakra UI v3.

## Structure

```
src/
  types/        # TypeScript interfaces (asset, balance, market, staking, events, burn, block, etc.)
  utils/        # Pure utility functions (amount math, formatting, denom helpers, etc.)
  constants/    # Chain config, endpoints, assets, keplr, testnet definitions, ecosystem nav
  storage/      # localStorage wrapper with TTL support + settings persistence
  service/      # Singleton services (AmmRouter, BlockchainEventManager, assets_factory, keplr)
  query/        # REST query clients (bank, staking, markets, pools, epochs, burner, raffle, block, module, etc.)
  hooks/        # React hooks (useAssets, useBalances, useMarkets, useToast, useTx, useEpochs, etc.)
  contexts/     # Base AssetsContextType + AssetsContext — each app provides its own AssetsProvider
  components/   # Shared UI components (Sidebar, WalletSidebar, SettingsSidebar, Toaster, HighlightText)
                #   hive-glow/: the Hive Glow layout primitives (PageContainer, heroes, cards, notices, page states)
  theme/        # Hive Glow: token values + createHiveGlowSystem(app), the Chakra system every app uses
  index.ts      # Barrel exports (~170 exports)
```

## Key design decisions

- **AssetsContext**: The lib exports the base type and React context object. Each app implements its own `AssetsProvider` because the apps have different state (dex: locked liquidity, market filtering; burner: burns, raffles, pending contributions; staking: delegations; factory: owned tokens; communities: factory-denom directory). Apps that extend the base `AssetsContextType` should use `extends BaseAssetsContextType` and provide a typed wrapper hook (see burner's `useBurnerContext`, staking's `useStakingContext`).
- **Sidebar components**: Accept `accentColor` prop (default `"blue"`) to match each app's brand (dex=blue, burner=orange, staking=purple, factory=yellow, communities=green). The Sidebar wrapper, WalletSidebarContent, SettingsSidebarContent, and SettingsToggle are all shared.
- **Theme (Hive Glow)**: every app's `provider.tsx` builds its Chakra system with `createHiveGlowSystem('<app>')`. Values live only in `theme/hive-glow-tokens.ts`, copied from the graphics repo's `beezee/apps/theme/tokens.json`; no hex values elsewhere. Chakra's own semantic colours (`bg`, `fg`, `border`…) are remapped to the Hive Glow neutrals, the app's colours are the `app` palette (the body default), and everything else is under `hg.*` (colours, shadows, radii). Gradients: `app`, `appButton`, `appWord`, `featuredEdge`, `heroGlow`, `heroGlowInner`, `shimmer`. Buttons add `primary` / `secondary` / `danger` variants; badges and tags add `info` / `warning` / `danger` / `success` / `neutral`. Dark is the default colour mode (`defaultTheme="dark"` in each app's `color-mode.tsx`).
- **Toaster**: The lib creates and exports the Chakra toaster singleton + `<Toaster />` component. Each app must render `<Toaster />` in its layout.
- **Transaction hooks**: `useSDKTx`, `useBZETx`, `useIBCTx` are in the lib with `useToast` — the apps share them.
- **App-specific hooks NOT in the lib**: `useBlockchainListener` (different event subscriptions per app), `useNavigation` (different routes), and app-specific hooks like burner's `useBurningHistory`/`useRaffles`.
- **Configurable per-app**: Call `setStorageKeyVersion()` and `setDefaultTxMemo()` at module scope in layout.tsx.
- **Peer dependencies**: React, @chakra-ui/react, next-themes, @bze/bzejs, bignumber.js, chain-registry, @interchain-kit/*, @cosmjs/stargate, interchainjs, react-icons are all peer deps — the consuming app provides them.
- **Next.js integration**: Consuming apps should add `transpilePackages: ["@bze/bze-ui-kit"]` and `optimizePackageImports: ["@bze/bze-ui-kit"]` to their next.config.ts.
