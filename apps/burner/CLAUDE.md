# BZE Burner (burner.getbze.com)

Next.js 15 token burner frontend for the BeeZee blockchain. React 19, Chakra UI v3.

## Architecture

All shared code (hooks, utils, types, constants, query clients, services, storage, UI components) comes from `@bze/bze-ui-kit`. This app only contains burner-specific logic and UI components.

### What's local (app-specific)

```
src/
  app/              # Next.js pages (home/burn, coin details, raffles)
  components/       # Burner-specific UI (burn-modal, raffle-modal, search-coin-modal, raffle animations)
  contexts/
    assets_context.tsx  # Burner AssetsProvider — extends lib's base AssetsContextType with:
                        #   lockBalance, nextBurn, burnHistory, raffles, raffleWinners,
                        #   pendingRaffleContributions, settingsVersion
  hooks/
    useBurnerContext.tsx       # Typed wrapper: casts useAssetsContext() to burner's extended type
    useNavigation.tsx          # Burner route helpers
    useBlockchainListener.tsx  # WebSocket events (burns, raffles, supply, locks)
    useBurningHistory.tsx      # Processed burn history with USD values and timestamps
    useNextBurning.tsx         # Next scheduled burn data
    useRaffles.tsx             # Raffle data, winners, pending contributions
```

### What comes from @bze/bze-ui-kit

Everything else: `useAssets`, `useBalances`, `useLiquidityPools`, `useEpochs`, `useSettings`, `useToast`, `useSDKTx`, `useAssetPrice`, `useAssetsValue`, all utils, all types, all constants, all query clients (including burner, raffle, block, module queries), all services, sidebar components (`accentColor="orange"`), toaster, HighlightText.

### Extended context pattern

The burner's `AssetsContextType` extends the lib's base type:

```tsx
import type { AssetsContextType as BaseAssetsContextType } from "@bze/bze-ui-kit";

export interface AssetsContextType extends BaseAssetsContextType {
    lockBalance: Map<string, Balance>;
    nextBurn: NextBurn | undefined;
    burnHistory: BurnedCoinsSDKType[];
    raffles: Map<string, RaffleSDKType>;
    // ... other burner-specific fields
}
```

Use `useBurnerContext()` (from `@/hooks/useBurnerContext`) to access burner-specific fields. Use `useAssetsContext()` from the lib for base fields.

## App initialization (layout.tsx)

```tsx
import { setStorageKeyVersion, setDefaultTxMemo, Toaster } from '@bze/bze-ui-kit';
setStorageKeyVersion('2');
setDefaultTxMemo('burner.getbze.com');
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
