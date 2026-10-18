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
    governance/     # Governance UI: list (tally bar, cards, finished list, rules), markdown, vote-flow (dialog / phone sheet), proposal/ (page panels)
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
    useVoter.ts                # Connected wallet: voting power (bonded validators only), its vote + its validators' votes per open proposal
    useIsPhone.ts              # Below `md`, for markup that differs by width (dialog vs bottom sheet)
    useOpenProposalsSummary.ts # Open proposals + the wallet's own votes and power for the nav badge / dashboard banner; module-wide store, one load per 60 s shared by all consumers, invalidated by the vote flow
  lib/
    governance/     # Pure gov helpers: tally + checks, kind/title, dates, describe/ (Scan's message describers), details (deposit, final checks, timeline), voter (power, votes, vote choices), summary (badge count, banner copy), safeUrl
```

Governance reads x/gov v1 through ui-kit's `query/gov.ts`, which returns the chain's REST JSON as is (`types/gov.ts`: string ids, RFC 3339 times, enum names). Deposit-period proposals are never shown. BZE Scan links use ui-kit's `getExplorerProposal*URL` (`NEXT_PUBLIC_EXPLORER_URL`). A proposal's summary is untrusted: it only goes through `components/governance/markdown.tsx` (no raw HTML, `safeUrl`, images as links). `lib/governance/describe/` and `markdown.tsx` are ports of BZE Scan's `ui/src/render/proposals` and markdown component; keep them in step. Test fixtures are real mainnet proposals (`lib/governance/fixtures/`).

Voting: `useVoter` layers the wallet's data on top of the wallet-free `useGovernance` / `useProposal`; a validator votes from its own account (`valoperToAccountAddress` in ui-kit). `vote-flow.tsx` sends one gov v1 `MsgVote` through `useSDKTx` (amino by default) and, on success, the page re-reads the vote and the tally, and `invalidateOpenProposalsSummary()` refreshes the nav badge and the dashboard banner (`governance-callout.tsx`, rendered in `StakingOverview`'s `callout` slot).
