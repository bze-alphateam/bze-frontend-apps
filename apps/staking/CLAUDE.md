# BZE Staking (staking.getbze.com)

Next.js staking frontend for the BeeZee blockchain. React 19, Chakra UI v3.

> Commands, env vars, patches, deploy: the **repo root README.md** owns all of that. This file is architecture only.

## Architecture

All shared code comes from `@bze/bze-ui-kit`; this app only contains staking-specific logic and UI. Same pattern as dex/burner: an app-specific `AssetsProvider` extends the lib's base `AssetsContextType`.

### What's local (app-specific)

```
src/
  app/              # Next.js pages (staking dashboard) + app/api routes
  components/
    staking/        # Staking-specific UI
    ui/             # Small local UI pieces
  contexts/
    assets_context.tsx  # Staking AssetsProvider — extends lib's base AssetsContextType
  hooks/
    useStakingContext.tsx      # Typed wrapper over useAssetsContext() (like burner's useBurnerContext)
    useNativeStakingData.tsx   # Validator delegation and staking data
    useNavigation.tsx          # Staking route helpers
    useBlockchainListener.tsx  # WebSocket event subscriptions
```
