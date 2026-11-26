# BZE DAO (dao.getbze.com)

Next.js frontend for the BeeZee chain's x/dao module (chain v8.3.0). React 19, Chakra UI v3.

> Commands, env vars, patches, deploy: the **repo root README.md** owns all of that. This file is architecture only.

## Architecture

All shared code comes from `@bze/bze-ui-kit` (the x/dao queries, message builders, validation and tally rules live in `query/dao.ts` and `utils/dao/`). Same shell as staking: an app-specific `AssetsProvider` extends the lib's base `AssetsContextType`, Hive Glow system with the DAO accent (`createHiveGlowSystem('dao')`), shared `AppHeader` with the nav items "DAOs" (`/`) and "Create" (`/create`, reserved for the create flow).

```
src/
  app/              # pages: `/` (home), `/dao/[id]` and `/proposal/[id]` (stubs until their stories), `/create` (coming soon) + app/api/scan (proxy)
  components/
    dao/            # home page parts: home (composition), all-daos (type filter, search, Load more), my-daos, open-proposals, explainer, dao-card, unsupported
    ui/             # provider, colour mode, navbar, inner hero
  contexts/assets_context.tsx   # DAO AssetsProvider — extends lib's base AssetsContextType
  hooks/            # useAsync (key-derived loading, no setState in effects), useDaoList (first page + Load more), useDaoContext, navigation, chain listener
  lib/
    scan-proxy.ts   # server side of /api/scan: only the DAO routes, per-route query allowlist (repeated params kept), finished DAO proposals kept forever
    dao-scan.ts     # client of the proxy: listDaos / openProposals / filtersSupported probe; getter injected
    dao-loader.ts   # the home page's reads with their fallbacks (loadDaoPage, loadMyDaos, loadOpenProposals); Scan and chain injected as interfaces
    dao-chain.ts    # composition root: ui-kit's chain queries + the browser Scan client
    dao-cards.ts, my-daos.ts, staker-sources.ts, format.ts, dao-types.ts   # pure helpers
```

## Data

- **Lists come from BZE Scan** (`/api/v1/daos`, `/api/v1/dao-proposals`) through the app's own `/api/scan` route (Scan sends no CORS headers for this app). Scan's `type` values are `static_list` / `stake`; proposal statuses are lower-case chain names.
- **Fallbacks**: Scan down → the All DAOs list reads the chain's `/bze/dao/daos` (no filters, no open counts, the filter runs on the page) with a notice; "My DAOs" always keeps the administered DAOs from the chain (`daos_by_admin`). Scan's `supported: false`, or the chain's `isDaoModuleSupported()` false while Scan is down, is the one friendly "arrive with v8.3.0" state. A chain network failure is an error, never "not supported".
- **Scan filters of BFE-368** (`member`, `source`, `q`, the cross-DAO `dao-proposals` list): a Scan without them *ignores* the unknown parameters and answers the whole list, so `filtersSupported()` probes once with an invalid `member` address (a newer Scan answers 400, an older one 200). Without them My DAOs lists only the administered DAOs (with a notice), the name search runs on the loaded page and the open-proposals feed is hidden.
- **My DAOs** = administered (chain) ∪ `member` (Scan) ∪ `source` (Scan, the wallet's x/rewards positions as `sr/{reward_id}` / `dr/{staking_denom}`, 20 per request). One row per DAO with every reason ("Admin", "Member", "Staker"); self-owned DAOs are never "Admin".

## Tests

Vitest next to the code (`src/**/*.test.ts`, pure helpers through their public API, collaborators injected). Playwright e2e in `e2e/` (CI only, workflow `e2e-dao`): fixtures for the chain, aggregator and Scan answer fake `*.e2e.test` hosts; a fake Keplr (`e2e/support/fake-keplr.ts`) connects a wallet. See `e2e/README.md`.
