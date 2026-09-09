# BZE Frontend Apps

[![CI](https://github.com/bze-alphateam/bze-frontend-apps/actions/workflows/ci.yml/badge.svg)](https://github.com/bze-alphateam/bze-frontend-apps/actions/workflows/ci.yml)

Turborepo + pnpm monorepo for the BeeZee frontend apps and their shared library.
One repo, one install, no publishing — edit the shared lib and every app sees it instantly.

```
bze-frontend-apps/
├── apps/
│   ├── dex/          → bze-dapp-v2     (the DEX — orderbook + AMM pools)
│   ├── burner/       → bze-burner      (token burner + raffles)
│   ├── staking/      → bze-staking     (staking UI)
│   ├── factory/      → bze-factory     (Token Factory — create/manage tokens, pools, markets, rewards)
│   └── communities/  → bze-communities (per-token pages for `factory/` denoms)
├── packages/
│   └── ui-kit/       → @bze/bze-ui-kit (shared hooks/utils/query/services/UI)
├── pnpm-workspace.yaml   ← workspace globs + overrides + patches + build approvals
├── turbo.json            ← task pipeline (build order, caching, env hashing)
└── package.json          ← root scripts, pins pnpm version
```

All five apps are **Next.js 16 / React 19 / Chakra UI v3** and all consume `@bze/bze-ui-kit`
through the workspace (`"@bze/bze-ui-kit": "workspace:*"`) — **no npm tag/publish/version bump.**

---

## Prerequisites

- **Node** ≥ 20 (Node 24 is fine; the repo pins `engines.node >=20`).
- **pnpm 11** — installed standalone (NOT via `npm i -g pnpm`). The version is pinned in
  `package.json` (`"packageManager": "pnpm@11.6.0"`).
- You do **not** need npm/yarn. Everything goes through pnpm.

---

## Install

From the repo root:

```sh
pnpm install
```

This installs **all** apps + the lib in one shot and links `@bze/bze-ui-kit` into each app.
Run it again after pulling changes or editing any `package.json` / `pnpm-workspace.yaml`.

---

## Develop

> 🛑 **Memory warning:** running several Next dev servers at once can OOM the machine.
> Start **one app at a time** unless you know you have the RAM.

Run any app from the repo root with `pnpm --filter <name> dev`. The pnpm package name
differs from the folder name — use the **name** column:

| App | Folder | `--filter` name | Dev port |
|---|---|---|---|
| DEX         | `apps/dex`         | `bze-dapp-v2`     | 3000 |
| Burner      | `apps/burner`      | `bze-burner`      | 3001 |
| Staking     | `apps/staking`     | `bze-staking`     | 3002 |
| Factory     | `apps/factory`     | `bze-factory`     | 3003 |
| Communities | `apps/communities` | `bze-communities` | 3004 |

```sh
pnpm --filter bze-dapp-v2     dev   # DEX         → http://localhost:3000
pnpm --filter bze-burner      dev   # Burner      → http://localhost:3001
pnpm --filter bze-staking     dev   # Staking     → http://localhost:3002
pnpm --filter bze-factory     dev   # Factory     → http://localhost:3003
pnpm --filter bze-communities dev   # Communities → http://localhost:3004
```

Each app's dev script bakes in its own port (`next dev --webpack -p <port>`), so you can run
several at once without passing `-- -p`. Local config comes from each app's own `.env` — copy it
from that app's committed `.env.dist` template, which every app now has.

> **Why `dev` uses `--webpack`:** the dev scripts run `next dev --webpack` on purpose.
> The apps rely on webpack `resolve.alias` (see *“The one real gotcha”* below) to force
> single instances of the wallet/wagmi libraries. Next 16's default dev bundler (turbopack)
> mangles those absolute alias paths, which breaks the wallet React context
> (`useInterChainWalletContext must be used within a InterChainProvider`). Webpack dev avoids
> that and matches how the apps build. Don't remove the flag.

Editing `packages/ui-kit` while an app dev server runs: the app hot-reloads. ui-kit is built
with tsup; if a lib change doesn't show up, run its watch build in a second terminal:

```sh
pnpm --filter @bze/bze-ui-kit dev   # tsup --watch
```

---

## Build

Build everything (Turbo runs ui-kit first, then the apps, and caches results):

```sh
pnpm build                                       # = turbo run build
pnpm exec turbo run build --concurrency=1        # build apps one at a time (lower peak memory)
pnpm exec turbo run build --concurrency=3        # build 3 apps at a time (needs the RAM)
```

> **Don't** write `pnpm build -- --concurrency=1`. The `--` makes turbo pass `--concurrency`
> through to each package's build command (tsup/next), which don't understand it and error.
> `--concurrency` is a **turbo** flag, so call turbo directly: `pnpm exec turbo run build --concurrency=N`.

Build a single app (and only its dependencies):

```sh
pnpm --filter bze-dapp-v2 build
```

Re-running `build` with no changes replays from Turbo's cache instantly. The apps build with
`next build --webpack` and output to each app's `.next/`.

Lint / type-check:

```sh
pnpm lint                       # eslint + tsc across the workspace
pnpm --filter bze-burner lint
```

---

## Tests

Unit tests run on **Vitest**. They are part of the CI merge gate: the `test` job in
`ci.yml` is a **required status check** on `develop` and `main` (alongside `build` and
`lint`), so no code reaches a deploy without passing tests.

### Run them

```sh
pnpm test                                  # = turbo run test (ui-kit + every app)
pnpm --filter @bze/bze-ui-kit test         # just the ui-kit suite
pnpm --filter bze-communities test         # just one app's suite
pnpm --filter @bze/bze-ui-kit test:watch   # watch mode while developing
pnpm --filter @bze/bze-ui-kit exec vitest run src/utils/amount.test.ts   # a single file
```

Turbo caches test runs per package — `pnpm test` with no changes replays from cache.
The `test` task depends on `^build`, so an app's tests always run against a freshly
built ui-kit. Every app defines `"test": "vitest run"`; apps with no tests yet still
pass the gate (`passWithNoTests`), so `turbo run test` covers the whole workspace.

### What's covered today

Only `packages/ui-kit` has a suite so far — test files live next to the code they cover
(`src/**/*.test.ts`, node environment, config in `packages/ui-kit/vitest.config.ts`):

| File | Covers |
|---|---|
| `src/utils/amount.test.ts` | uAmount ↔ amount conversions, price ↔ uPrice exponent shifts, big-number precision (> `MAX_SAFE_INTEGER`), `prettyAmount` formatting, round-trips |
| `src/utils/liquidity_pool.test.ts` | AMM reserve-ratio math (`calculatePoolOppositeAmount`), pool pricing, user share % / USD value, division-by-zero guards |
| `src/utils/fee_conversion.test.ts` | fee-token engine — chain-mirrored `calculateOptimalInputForOutput` (constant product + swap fee, ceil), `estimateFeeInPreferredDenom` reasons (native / estimated / no-pool / low-liquidity / pool-too-small), `resolveFeePayment` charging order (preferred → native fallback → insufficient) |
| `src/utils/denom.test.ts` | factory / IBC / LP denom classification (legacy `ulp_` **and** hashed `ulp/` formats), native denom, center-truncation |
| `src/utils/validation.test.ts` | endpoint URL validation — **offline paths only** (empty / malformed / wrong protocol); nothing that opens sockets |
| `src/utils/strings.test.ts` | center truncation, leading-zero stripping |
| `src/constants/ecosystem.test.ts` | ecosystem nav list — `NEXT_PUBLIC_ECOSYSTEM_LINK_*` / `_LABEL_*` overrides, `_EXCLUDED` filtering, and `getEcosystemApp()` ignoring exclusions |

Conventions:
- Pure functions only, no mocks, no network. Anything that needs a live endpoint or a
  wallet does **not** belong in this suite.
- ui-kit targets ES2017, so **no BigInt literals** in tests — write `BigInt(1000)`, not `1000n`.

The **apps** additionally have a component-test harness (jsdom + React Testing Library).
`apps/communities` is the reference suite:

| File | Covers |
|---|---|
| `src/lib/token-directory.test.ts` | pure directory logic — factory-denom filter, alphabetical-by-ticker sort, `getTotalPages` / `pageSlice` (20/page) client-side pagination, `clampPage`, `tokenPagePath()` URL-encoding |
| `src/app/page.test.tsx` | the directory page renders loading / empty / list states, paginates at 20 and advances on **Next**, and links each card to the URL-encoded token page |

### App tests (Vitest + React Testing Library)

Every app under `apps/*` shares one preset, `@bze/vitest-preset` (`packages/vitest-preset`),
so the config never drifts. An app's `vitest.config.ts` is just:

```ts
import { fileURLToPath } from "node:url";
import { createAppVitestConfig } from "@bze/vitest-preset";
export default createAppVitestConfig(fileURLToPath(new URL(".", import.meta.url)));
```

The preset provides: the React plugin (JSX/TSX), a **jsdom** DOM, the `@/*` → `src/*`
alias, test discovery (`src/**/*.test.{ts,tsx}`), `passWithNoTests`, and a shared setup
that registers `@testing-library/jest-dom` matchers and auto-`cleanup()`s between tests.
Tool versions live in one place — the `catalog:` block in `pnpm-workspace.yaml` — and are
referenced by both the preset and each app, so vitest stays a single physical instance.

Guidelines for writing app tests:
- **Extract logic, then test it.** Pull inline page/component logic into a pure,
  React-free `src/lib/*.ts` helper and unit-test that (see `communities/src/lib/token-directory.ts`).
  Keep those helpers free of `next/*` imports so they test in isolation.
- **Import test globals explicitly** — `import { describe, it, expect } from "vitest"` (no
  `globals: true`). This matches ui-kit and keeps ESLint / `next build`'s type-check happy.
- **Component tests** wrap the tree in a minimal `<ChakraProvider value={defaultSystem}>`
  and `vi.mock` the app's context hook (e.g. `useCommunitiesContext`) to feed state —
  no wallet / chain providers needed. See `communities/src/app/page.test.tsx`.
- Test files (`*.test.ts[x]`) and `vitest.config.ts` are excluded from each app's
  `tsconfig.json`, so `next build` never type-checks them.
- Need setup shared across all apps (a new global matcher, a polyfill)? Add it to the
  preset's `setup.ts` — it runs before every app's tests.

### TODO — next steps (in rough priority order)

- [ ] **Cover the remaining ui-kit utils**: `market.ts`, `charts.ts`, `formatter.ts`,
      `coins.ts`, `ibc.ts`, `address.ts`, `cross_chain.ts`, `staking.ts`, `tx_state.ts`,
      `events.ts` (~1,000 untested lines of pure logic left in `src/utils/`).
- [ ] **Test the storage layer** (`packages/ui-kit/src/storage/` — TTL + key-versioning
      logic is pure enough; needs a localStorage stub, e.g. happy-dom or a manual mock).
- [ ] **Hook tests** with `@testing-library/react` + a `QueryClientProvider` wrapper:
      start with ui-kit query hooks (`useMarkets`, `useBalances`, `usePrices`), then
      app-local hooks (dex: `useLockedLiquidity`; burner: `useRaffles`, `useNextBurning`).
      Requires mocking the query layer (vi.mock on `query/*` or MSW).
- [x] **App component-test harness** — shared `@bze/vitest-preset` (jsdom + RTL) wired
      into all 5 apps; `communities` directory suite is the reference (BFE-41).
- [ ] **Per-app suites** for dex / staking / burner / factory — each is its own follow-up
      story off this harness (see the "App tests" section for the pattern).
- [ ] **Component tests** for form-heavy flows (order placement validation in dex, burn
      flow in burner) — Chakra provider wrapper + `vi.mock`ed context/wallet, per above.
- [ ] **Playwright smoke suite** as a separate CI job: `next build && next start` each
      app, load the main pages, assert no crashes / console errors, with network calls
      mocked via `page.route()` (never hit live chain RPC from CI). This catches the
      "builds fine but white-screens at runtime" class that `next build` misses.
- [ ] **Coverage reporting** (`vitest --coverage`) once there's enough surface to make
      the number meaningful — consider a soft threshold on `packages/ui-kit/src/utils`.
- [ ] **Coverage per app** once each app grows a suite — the `test` script and turbo
      wiring are already in place, so new test files are picked up automatically.

---

## Deploy (production & testnet — Docker)

### One image per app per network

`NEXT_PUBLIC_*` env vars are inlined at **build time**, so testnet and mainnet are
**different builds**. CI (`.github/workflows/docker-publish.yml`) builds every app on
every push and publishes self-contained Node images (Next.js standalone) to GHCR:

| push to | flavor | env baked in | image tag |
|---|---|---|---|
| `main` | mainnet | `apps/<app>/.env.mainnet.dist` | `<sha8>` |
| `develop` | testnet | `apps/<app>/.env.testnet.dist` | `testnet-<sha8>` |

Images are named `ghcr.io/bze-alphateam/bze-dapp-<app>` (`dex`, `burner`, `staking`,
`factory`, `communities`). All five are built on every push — even single-app changes —
so any commit on a deploy branch has a complete image set (the server-side release
pollers rely on that).

### Env files

- `.env.mainnet.dist` / `.env.testnet.dist` (committed, per app) hold the flavor's
  `NEXT_PUBLIC_*` values. Everything in them is public by definition — it ends up in
  the client bundle. **No secrets, ever.**
- `SKIP_API_KEY` is the one runtime-only variable (server-side Skip proxy auth). It is
  **never baked into an image**: production injects it into the container environment.
  The dist files list it empty purely as documentation.
- `.env.dist` remains the local-dev template (copy to `.env`).
- **Release gate for `apps/communities`:** `NEXT_PUBLIC_COMMUNITIES_ENABLED` (default
  enabled; only the literal `false` hides the app) makes the build serve the "under
  construction" placeholder on every route — no providers, no wallet/RPC traffic, Skip
  proxy answers 404. It exists so `develop` can merge into `main` before the app is
  public: `.env.mainnet.dist` sets it to `false`, testnet leaves it enabled. Launching
  communities.getbze.com is a one-line change to the mainnet dist file (value is baked
  in at build time, so it needs a new image, not a container restart).

### Build locally (what CI does)

```sh
docker build -f docker/prod/Dockerfile \
  --build-arg APP=dex --build-arg PKG=bze-dapp-v2 --build-arg FLAVOR=mainnet .
```

`APP` is the directory under `apps/`, `PKG` its `package.json` name, `FLAVOR` picks the
env file. The container serves on port 3000.

### Releasing

Server-side deploys (blue/green flip, health-gated, automatic on merge) live in a
separate private ops repo — nothing in this repo touches the server. Merging to `main`
deploys mainnet within minutes; rollback = revert on `main`.

---

## How the shared lib works

- `@bze/bze-ui-kit` lives in `packages/ui-kit` and is consumed via `"workspace:*"`. **Never bump a
  version or publish to npm** for internal use — editing the source is enough.
- Apps must keep `transpilePackages: ["@bze/bze-ui-kit"]` in their `next.config.ts` (already set).
- The lib's runtime deps (React, Chakra, interchain-kit, wagmi, bzejs, …) are **peerDependencies**
  — provided by each app, not bundled by the lib. Keep app versions aligned with the lib's peers.

---

## Common tasks

### Add a new shared export to ui-kit
Add the code under `packages/ui-kit/src/…`, then export it from `src/index.ts` (the barrel).
Apps import it from `"@bze/bze-ui-kit"`. No publish, no version bump.

### Add a dependency to an app
```sh
pnpm --filter bze-dapp-v2 add some-package
```
If an app imports a package, it must **declare** it (pnpm is strict — no “phantom” deps that only
work because something else pulled them in). If a build fails with `Cannot find module 'x'`, add `x`
to that app's `package.json` and reinstall.

### Add a brand-new app
1. Create `apps/<name>/` (copy an existing app's `next.config.ts` so you inherit the singleton
   aliasing + connector stubs).
2. Set `"@bze/bze-ui-kit": "workspace:*"` in its `package.json`; make `dev` = `next dev --webpack`
   with a free port, and `build` = `next build --webpack`.
3. Commit a `.env.dist` template (CI copies it to `.env` to seed the merge-gate build) plus the
   `.env.mainnet.dist` / `.env.testnet.dist` flavor files the Docker builds bake in.
4. `pnpm install`. The workspace picks the app up automatically via the `apps/*` glob, and so does
   Turbo.
5. **Add the app to the hardcoded lists that the glob doesn't cover** — easy to miss:
   - `.github/workflows/ci.yml` — two `for app in dex burner staking factory communities` loops
     (env seeding in `build`, and the per-app ESLint in `lint`). Miss the first and the app builds
     with no env; miss the second and its files are never linted.
   - `.github/workflows/docker-publish.yml` — the app/pkg build matrix.
   - the private ops repo — deploy dir, port pair, vhost (see *Deploy* above).

### Pin / override a dependency version everywhere
Edit `overrides:` in `pnpm-workspace.yaml` (NOT `package.json` — pnpm 11 ignores the package.json
`pnpm.overrides` field). Current pins: `axios`, the `wagmi`/`@wagmi/core`/`@wagmi/connectors`/`viem`
set, and `@interchain-kit/store` — these keep the tree on known-good versions.

### Patches to node_modules
Handled natively by pnpm via `patchedDependencies:` in `pnpm-workspace.yaml` (we no longer use
`patch-package`). The one active patch is `patches/@interchain-kit__store@0.9.1.patch`.

### Native build scripts (sharp, esbuild, secp256k1, …)
pnpm 11 blocks postinstall build scripts until approved. Approved packages are listed under
`allowBuilds:` in `pnpm-workspace.yaml`. If install warns about an *ignored build*, add the package
there with `: true` and reinstall.

---

## The one real gotcha (read this if wallet/context breaks)

Under pnpm's strict (non-flat) `node_modules`, a package with peer deps can end up **duplicated** —
two physically separate copies of the same version. For React-context libraries that's fatal: a
provider rendered from one copy isn't visible to a hook imported from the other, e.g.
`useInterChainWalletContext must be used within a InterChainProvider`.

Fix already in place: each app's `next.config.ts` has a `SINGLETONS` list
(`@interchain-kit/react`, `@interchain-kit/core`, `wagmi`, `@wagmi/core`) aliased to that app's
single copy via `resolve.alias` (webpack) / `resolveAlias` (turbopack). If you upgrade the wallet
stack and a new context-bearing package starts duplicating (symptom: a “must be used within …
Provider” error), add it to that `SINGLETONS` array. To check for duplicates:

```sh
ls -d node_modules/.pnpm/<pkg>@* | sort   # more than one dir for a single version = duplicated
```

---

## Troubleshooting quick reference

| Symptom | Cause | Fix |
|---|---|---|
| corepack `Cannot find matching keyid` crash | a corepack pnpm shim is shadowing your standalone pnpm | ensure your standalone pnpm is first on `PATH` (reinstall via pnpm's standalone installer if needed) |
| `must be used within a …Provider` | duplicate React-context instance | add the package to `SINGLETONS` in the app's `next.config.ts` |
| `Cannot find module 'x'` at build | phantom dependency (imported but not declared) | `pnpm --filter <app> add x` |
| install warns *ignored build scripts* | pnpm 11 build-script gate | add pkg to `allowBuilds:` in `pnpm-workspace.yaml`, reinstall |
| weird transitive version after fresh install | version drift (no lockfile pin) | pin it in `overrides:` and commit `pnpm-lock.yaml` |
| machine freezes / OOM | too many Next dev servers at once | run one app at a time |

**Always commit `pnpm-lock.yaml`** — it's what keeps everyone (and the server) on identical,
known-good dependency versions.
