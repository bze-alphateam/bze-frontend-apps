# BZE Communities (communities.getbze.com)

Next.js frontend giving every Token Factory token (`factory/` denoms) a dedicated page on the BeeZee blockchain. React 19, Chakra UI v3. Accent color: **green**.

> Commands, env vars, patches, deploy: the **repo root README.md** owns all of that. This file is architecture only.
> Product/business/technical docs: Confluence space `B` → "Communities dApp" page tree. Jira epic: BZE-55.

## Architecture

All shared code comes from `@bze/bze-ui-kit`; this app only contains communities-specific logic and UI. Same pattern as dex/burner/staking: an app-specific `AssetsProvider` extends the lib's base `AssetsContextType`. Storage key version: `'5'`.

### What's local (app-specific)

```
src/
  app/              # Next.js pages (token directory at /, token pages at /token?denom=…) + api/skip proxy
  components/
    ui/             # Navbar, color mode, Chakra provider
  contexts/
    assets_context.tsx  # Communities AssetsProvider — extends lib's base AssetsContextType
  hooks/
    useCommunitiesContext.tsx  # Typed wrapper over useAssetsContext() (like staking's useStakingContext)
    useNavigation.tsx          # Route helpers
    useBlockchainListener.tsx  # WebSocket event subscriptions
```

## Release gate

`NEXT_PUBLIC_COMMUNITIES_ENABLED` (`src/lib/app-gate.ts`, default enabled, only the literal `false` hides the app). `src/app/layout.tsx` swaps the whole app — providers included — for `src/components/under-construction/` when it is off, and the Skip proxy route returns 404. Mainnet (`.env.mainnet.dist`) ships with `false` until the public launch; testnet and local dev leave it on. Baked in at build time.

## Domain rules (short version — Confluence is the authority)

- Only `factory/` denoms get pages; the token page URL carries the denom URL-encoded in the `?denom=` query param (never in the path).
- The token page rebrands the chrome to the token (logo + name) — direct visits should feel like the token's own site.
- "Get the token" buy flow and the fee-token setting are gated by fee-eligibility: an AMM pool paired with BZE whose BZE reserve exceeds tradebin `min_native_liquidity_for_module_swap`.
