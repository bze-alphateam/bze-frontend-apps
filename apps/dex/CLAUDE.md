# BZE DEX (dex.getbze.com)

Next.js 16 decentralized exchange frontend for the BeeZee blockchain. React 19, Chakra UI v3, Recharts.

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

### What comes from @bze/bze-ui-kit

Everything else: `useAssets`, `useBalances`, `useMarkets`, `useLiquidityPools`, `useLiquidityPool`, `useEpochs`, `useSettings`, `useToast`, `useSDKTx`, `useAssetPrice`, `useAssetsValue`, all utils, all types, all constants, all query clients, all services, sidebar components, toaster, HighlightText.

## App initialization (layout.tsx)

```tsx
import { setStorageKeyVersion, setDefaultTxMemo, Toaster } from '@bze/bze-ui-kit';
setStorageKeyVersion('3');
setDefaultTxMemo('dex.getbze.com');
```

## Next.js config

```ts
transpilePackages: ["@bze/bze-ui-kit"],
experimental: {
    optimizePackageImports: ["@chakra-ui/react", "@bze/bze-ui-kit"]
}
```

## Development

```sh
npm install
npm run dev     # Start dev server
npm run build   # Production build
npm run lint    # ESLint + type check
```

## Patches

`patches/@interchain-kit+store+0.9.1.patch` — fixes `@interchain-kit/store` passing `{}` instead of `undefined` as signOptions in `ChainWalletStore.getOfflineSigner()`, which caused Keplr to override custom fee denoms. PR submitted upstream: https://github.com/hyperweb-io/interchain-kit/pull/XXX. Remove this patch once the fix is released upstream.

## Environment variables

See `@bze/bze-ui-kit` README for the full list of `NEXT_PUBLIC_*` env vars. Copy `.env.dist` from the lib as a starting template.
