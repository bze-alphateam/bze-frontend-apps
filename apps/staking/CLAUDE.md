# BZE Staking (staking.getbze.com)

Next.js staking frontend for the BeeZee blockchain. React 19, Chakra UI v3.

> Commands, env vars, patches, deploy: the **repo root README.md** owns all of that. This file is architecture only.

## Architecture

All shared code comes from `@bze/bze-ui-kit`; this app only contains staking-specific logic and UI. Same pattern as dex/burner: an app-specific `AssetsProvider` extends the lib's base `AssetsContextType`.

### What's local (app-specific)

```
src/
  app/              # Next.js pages (staking dashboard, /governance, /governance/[id]) + app/api routes
  components/
    staking/        # Staking-specific UI
    governance/     # Governance UI: list (tally bar, cards, finished list, rules), markdown, proposal/ (page panels)
    ui/             # Small local UI pieces
  contexts/
    assets_context.tsx  # Staking AssetsProvider — extends lib's base AssetsContextType
  hooks/
    useStakingContext.tsx      # Typed wrapper over useAssetsContext() (like burner's useBurnerContext)
    useNativeStakingData.tsx   # Validator delegation and staking data
    useNavigation.tsx          # Staking route helpers
    useBlockchainListener.tsx  # WebSocket event subscriptions
    useGovernance.ts           # Gov params, open proposals + live tallies (60 s poll while visible), finished pages
    useProposal.ts             # One proposal + params + bonded tokens; live tally polled only while voting
  lib/
    governance/     # Pure gov helpers: tally + checks, kind/title, dates, describe/ (Scan's message describers), details (deposit, final checks, timeline), safeUrl
```

Governance reads x/gov v1 through ui-kit's `query/gov.ts`, which returns the chain's REST JSON as is (`types/gov.ts`: string ids, RFC 3339 times, enum names). Deposit-period proposals are never shown. BZE Scan links use ui-kit's `getExplorerProposal*URL` (`NEXT_PUBLIC_EXPLORER_URL`). A proposal's summary is untrusted: it only goes through `components/governance/markdown.tsx` (no raw HTML, `safeUrl`, images as links). `lib/governance/describe/` and `markdown.tsx` are ports of BZE Scan's `ui/src/render/proposals` and markdown component; keep them in step. Test fixtures are real mainnet proposals (`lib/governance/fixtures/`).
