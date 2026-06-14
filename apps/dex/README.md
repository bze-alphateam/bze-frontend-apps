# BZE DEX (dex.getbze.com)

Decentralized exchange frontend for the BeeZee blockchain. Built with Next.js 15, React 19, Chakra UI v3, and Recharts.

## Architecture

All shared code (hooks, utils, types, constants, query clients, services, storage, UI components) comes from `@bze/bze-ui-kit`. This app only contains DEX-specific logic.

### What's local (app-specific)

```
src/
  app/              # Next.js pages (swap, exchange, pools, staking, assets)
  components/       # DEX-specific UI (trading, staking, navigation, token logos,
  │                 #   blockchain-listener-wrapper)
  contexts/
  │ assets_context.tsx     # DEX AssetsProvider — extends lib's AssetsContextType
  hooks/
    useNavigation.tsx          # DEX route helpers
    useBlockchainListener.tsx  # WebSocket event subscriptions (orders, swaps, blocks)
    useLockedLiquidity.tsx     # Locked LP token queries for pool details
    useNativeStakingData.tsx   # Validator delegation and staking data
    useRewardsStakingData.tsx  # Rewards staking program data
```

### What comes from @bze/bze-ui-kit

Everything else: `useAssets`, `useBalances`, `useMarkets`, `useLiquidityPools`, `useLiquidityPool`, `useEpochs`, `useSettings`, `useToast`, `useSDKTx`, `useWalletHealthCheck`, `subscribeToBlockchainEvents`, all event helpers (`isAddressTransfer`, `isBurnEvent`, etc.), all utils, all types, all constants, all query clients, all services, sidebar components, toaster, HighlightText.

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
npm run dev     # Start dev server (Turbopack)
npm run build   # Production build
npm run lint    # ESLint + type check
```

## Environment variables

Copy `.env.dist` as a starting template. Key vars:

| Env var | Description |
|---------|-------------|
| `NEXT_PUBLIC_CHAIN_ID` | Chain ID (e.g. `beezee-1`) |
| `NEXT_PUBLIC_CHAIN_NAME` | Chain name (e.g. `beezee`) |
| `NEXT_PUBLIC_APP_NAME` | App display name (also used as default tx memo) |
| `NEXT_PUBLIC_REST_ENDPOINT` | Default REST endpoint |
| `NEXT_PUBLIC_RPC_ENDPOINT` | Default RPC/WebSocket endpoint |
| `NEXT_PUBLIC_GAS_MULTIPLIER` | Gas estimate multiplier (default `1.5`) |

See `@bze/bze-ui-kit` README for the full list of supported env vars.
