# BZE Burner (burner.getbze.com)

Next.js token burner frontend for the BeeZee blockchain. React 19, Chakra UI v3.

> Commands, env vars, patches, deploy: the **repo root README.md** owns all of that. This file is architecture only.

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

### Look (Hive Glow)

- Home opens with the centred home hero ("The Burning Pot", Burn coins + Join a raffle), the countdown in the page's one `FeaturedCard`, then three stat tiles (`BurnStat`: BZE burned, value locked forever, coins in the pot). Inner pages (raffles) start with `components/ui/burner/inner-hero.tsx`; the coin page uses the inner glow and its own header row.
- Shared pieces live in `components/ui/burner/`: `parts.tsx` (section header, app pill, stat tile, table card + cells, stacked phone rows) and `dialog.tsx` (the dialog frame every Burner dialog uses, inset rows). Main actions are the `primary` button, Cancel/MAX/Info the `secondary`; info cards are the shared `Notice`, warnings the amber one.
- No emoji anywhere in the copy (`src/no-emoji.test.ts` scans every source file). Loading draws shimmer or `PageState` rows, never a bare "Loading..." on a blank page; tables become stacked rows below `md`.
- The raffle result overlay is always dark (`className="dark"`), its embers use the app gradient, and `usePrefersReducedMotion` turns every animation off.

### What comes from @bze/bze-ui-kit

Everything else: `useAssets`, `useBalances`, `useLiquidityPools`, `useEpochs`, `useSettings`, `useToast`, `useSDKTx`, `useAssetPrice`, `useAssetsValue`, all utils, all types, all constants, all query clients (including burner, raffle, block, module queries), all services, sidebar components (coloured by the Hive Glow system), toaster, HighlightText.

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
