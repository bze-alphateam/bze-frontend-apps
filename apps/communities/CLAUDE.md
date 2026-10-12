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
    directory/      # Token directory (home): search, filters, sort, pages, brand-coloured cards
    token-site/     # The token page as a standalone site; kit/ = communities-only design kit (--ts-* vars),
                    # wallet/ = the token's own wallet drawer (state in hooks/token-site/useTokenWallet)
    ui/             # BeeZee navbar (directory only), color mode, Chakra provider, pre-redesign token sections
  contexts/
    assets_context.tsx  # Communities AssetsProvider — extends lib's base AssetsContextType
  hooks/
    useCommunitiesContext.tsx  # Typed wrapper over useAssetsContext() (like staking's useStakingContext)
    useNavigation.tsx          # Route helpers
    useBlockchainListener.tsx  # WebSocket event subscriptions
```

## Release gate

`NEXT_PUBLIC_COMMUNITIES_ENABLED` (`src/lib/app-gate.ts`, hidden by default — only the literal `true` enables the app). `src/app/layout.tsx` swaps the whole app — providers included — for `src/components/under-construction/` when it is off, and the Skip proxy route returns 404. Mainnet (`.env.mainnet.dist`) ships with `false` until the public launch; testnet and local dev leave it on. Baked in at build time.

## Domain rules (short version — Confluence is the authority)

- Only `factory/` denoms get pages; the token page URL carries the denom URL-encoded in the `?denom=` query param (never in the path).
- The token page is a standalone site in the token's on-chain brand kit (`DEFAULT_DENOM_BRANDING` without one): no BeeZee navbar, logo or app links. Its visuals are communities-only components in `components/token-site/` — never restyle ui-kit visual components for it. The directory keeps the shared BeeZee top bar.
- "Get the token" buy flow and the fee-token setting are gated by fee-eligibility: an AMM pool paired with BZE whose BZE reserve exceeds tradebin `min_native_liquidity_for_module_swap`.
