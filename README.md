# BZE Frontend Apps

[![CI](https://github.com/bze-alphateam/bze-frontend-apps/actions/workflows/ci.yml/badge.svg)](https://github.com/bze-alphateam/bze-frontend-apps/actions/workflows/ci.yml)

Turborepo + pnpm monorepo for the BeeZee frontend apps and their shared library.
One repo, one install, no publishing — edit the shared lib and every app sees it instantly.

```
bze-frontend-apps/
├── apps/
│   ├── dex/        → bze-dapp-v2   (the DEX)
│   ├── burner/     → bze-burner    (token burner + raffles)
│   └── staking/    → bze-staking   (staking UI)
├── packages/
│   └── ui-kit/     → @bze/bze-ui-kit (shared hooks/utils/query/services/UI)
├── pnpm-workspace.yaml   ← workspace globs + overrides + patches + build approvals
├── turbo.json            ← task pipeline (build order, caching)
└── package.json          ← root scripts, pins pnpm version
```

The three apps are **Next.js 16 / React 19 / Chakra UI v3** and all consume `@bze/bze-ui-kit`
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
several at once without passing `-- -p`. Local config comes from each app's own `.env`
(copy from `.env.dist`). Factory is still a placeholder app (under-construction page) with no
wallet stack or env yet.

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
pnpm exec turbo run build --concurrency=3        # build all 3 apps in parallel (needs the RAM)
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
pnpm test                                  # = turbo run test (all packages that have tests)
pnpm --filter @bze/bze-ui-kit test         # just the ui-kit suite
pnpm --filter @bze/bze-ui-kit test:watch   # watch mode while developing
pnpm --filter @bze/bze-ui-kit exec vitest run src/utils/amount.test.ts   # a single file
```

Turbo caches test runs per package — `pnpm test` with no changes replays from cache.
The `test` task depends on `^build`, so an app's tests (once they exist) always run
against a freshly built ui-kit.

### What's covered today

Only `packages/ui-kit` has a suite so far — test files live next to the code they cover
(`src/**/*.test.ts`, node environment, config in `packages/ui-kit/vitest.config.ts`):

| File | Covers |
|---|---|
| `src/utils/amount.test.ts` | uAmount ↔ amount conversions, price ↔ uPrice exponent shifts, big-number precision (> `MAX_SAFE_INTEGER`), `prettyAmount` formatting, round-trips |
| `src/utils/liquidity_pool.test.ts` | AMM reserve-ratio math (`calculatePoolOppositeAmount`), pool pricing, user share % / USD value, division-by-zero guards |
| `src/utils/denom.test.ts` | factory / IBC / LP denom classification (legacy `ulp_` **and** hashed `ulp/` formats), native denom, center-truncation |
| `src/utils/validation.test.ts` | endpoint URL validation — **offline paths only** (empty / malformed / wrong protocol); nothing that opens sockets |
| `src/utils/strings.test.ts` | center truncation, leading-zero stripping |

Conventions:
- Pure functions only, no mocks, no network. Anything that needs a live endpoint or a
  wallet does **not** belong in this suite.
- ui-kit targets ES2017, so **no BigInt literals** in tests — write `BigInt(1000)`, not `1000n`.

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
- [ ] **Component tests** for form-heavy flows (order placement validation in dex, burn
      flow in burner) — needs a Chakra provider wrapper + wallet context stubs.
- [ ] **Playwright smoke suite** as a separate CI job: `next build && next start` each
      app, load the main pages, assert no crashes / console errors, with network calls
      mocked via `page.route()` (never hit live chain RPC from CI). This catches the
      "builds fine but white-screens at runtime" class that `next build` misses.
- [ ] **Coverage reporting** (`vitest --coverage`) once there's enough surface to make
      the number meaningful — consider a soft threshold on `packages/ui-kit/src/utils`.
- [ ] When adding tests to an app: add a `"test": "vitest run"` script to that app's
      `package.json` — turbo picks it up automatically (the `test` task is already wired).

---

## Deploy (production & testnet — pm2)

### One checkout per network

`NEXT_PUBLIC_*` env vars are inlined at **build time**, so testnet and mainnet are
**different builds**. The monorepo is therefore checked out **once per network**, each built
with that network's `.env` files:

```
<deploy-root>/bze-frontend-mainnet/current   ← built with mainnet .env files
<deploy-root>/bze-frontend-testnet/current   ← built with testnet .env files
```

`current` is a symlink to the active release. All apps in a checkout share one
`node_modules` and are built and released together (they share `ui-kit` and version-lock).

### Build (the normal flow — no special config)

In each checkout:

```sh
pnpm install --frozen-lockfile
pnpm exec turbo run build --concurrency=3   # builds ui-kit + every app, using the .env files present
```

Turbo hashes each app's `.env` / `.env.*` (see `inputs` on the `build` task in `turbo.json`), so
creating or editing an app's `.env` invalidates its cached build and forces a real `next build`.
That matters because `NEXT_PUBLIC_*` values are inlined at build time — without it, Turbo would
replay a `.next` built with the old env and the app would serve stale values forever. If you ever
suspect a cached build is wrong anyway, `--force` bypasses the cache for one run.

Each app's output lands in `apps/<app>/.next`. Nothing app-specific to run — one `pnpm build`
does the whole network.

### Run with pm2

Each app is one pm2 process running `next start` from its app dir **inside the checkout**.
Point `cwd` at `<checkout>/current/apps/<app>` — the `next` binary resolves through pnpm's
symlinks, so this is the same `next start` model as before; only `cwd` moves into the monorepo.
This collapses the old six per-app deploy dirs down to **two** (one per network).

```js
// ecosystem.config.js — lives on the server, NOT in this repo.
// Fill in <node> (an nvm node-24 binary) and <deploy-root>; ports/instances per your infra.
const node = "<path-to-node-24>";
const base = "<deploy-root>";
const next = "node_modules/next/dist/bin/next";

module.exports = {
  apps: [
    // ---------- mainnet ----------
    { name: "dex",     interpreter: node, script: next, args: "start --port 8085",
      cwd: `${base}/bze-frontend-mainnet/current/apps/dex`,     exec_mode: "cluster", instances: 3 },
    { name: "burner",  interpreter: node, script: next, args: "start --port 8084",
      cwd: `${base}/bze-frontend-mainnet/current/apps/burner`,  exec_mode: "cluster", instances: 2 },
    { name: "staking", interpreter: node, script: next, args: "start --port 8083",
      cwd: `${base}/bze-frontend-mainnet/current/apps/staking` },
    { name: "communities", interpreter: node, script: next, args: "start --port 8086",
      cwd: `${base}/bze-frontend-mainnet/current/apps/communities` },
    // factory is still an under-construction placeholder — add when it ships
    { name: "factory", interpreter: node, script: next, args: "start --port 8087",
      cwd: `${base}/bze-frontend-mainnet/current/apps/factory` },

    // ---------- testnet ----------
    { name: "testnet-dex",     interpreter: node, script: next, args: "start --port 8088",
      cwd: `${base}/bze-frontend-testnet/current/apps/dex` },
    { name: "testnet-burner",  interpreter: node, script: next, args: "start --port 8089",
      cwd: `${base}/bze-frontend-testnet/current/apps/burner` },
    { name: "testnet-staking", interpreter: node, script: next, args: "start --port 8090",
      cwd: `${base}/bze-frontend-testnet/current/apps/staking` },
    { name: "testnet-communities", interpreter: node, script: next, args: "start --port 8091",
      cwd: `${base}/bze-frontend-testnet/current/apps/communities` },
    { name: "testnet-factory", interpreter: node, script: next, args: "start --port 8092",
      cwd: `${base}/bze-frontend-testnet/current/apps/factory` },
  ],
};
```

The ports above just continue the existing pattern — they're illustrative, like the rest of this
example. Use whatever your nginx/Caddy front end actually routes to.

### Deploy a release

Run per network checkout (mainnet and/or testnet):

```sh
cd <checkout>                     # the mainnet or testnet monorepo clone
git pull
pnpm install --frozen-lockfile
pnpm exec turbo run build --concurrency=3   # Turbo's cache skips apps that didn't change
pm2 reload ecosystem.config.js              # reload only changed apps: pm2 reload ecosystem.config.js --only "dex.getbze,burner.getbze"
```

Notes:
- All apps in a network release **together**; Turbo only rebuilds what actually changed.
- `.env` files are per checkout and are **not** in git — keep each network's real `.env` on the
  server (only `.env.dist` templates are committed). A new app needs its `.env` in place **before**
  the first build of that checkout; `turbo.json` hashes `.env` so a later edit does invalidate the
  cache, but a first build without one bakes in the fallback defaults.
- Put nginx/Caddy in front routing each domain to its port.
- First-time setup: `pm2 start ecosystem.config.js` (then `pm2 save`).

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
2. Set `"@bze/bze-ui-kit": "workspace:*"` in its `package.json`; make `dev` = `next dev --webpack`.
3. `pnpm install`. It's picked up automatically by the `apps/*` glob.

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
