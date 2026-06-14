# BZE Frontend Apps

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

Each app runs on its own port. Run from the repo root with `--filter`:

```sh
pnpm --filter bze-dapp-v2 dev    # DEX      → http://localhost:3000
pnpm --filter bze-burner  dev    # Burner   → http://localhost:3000
pnpm --filter bze-staking dev    # Staking  → http://localhost:3000
```

To run two side by side, give them different ports:

```sh
pnpm --filter bze-burner dev -- -p 3001
```

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
pnpm build                      # = turbo run build
pnpm build -- --concurrency=1   # build apps one at a time (lower peak memory)
```

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

## Run in production (pm2 on your server)

1. On the server: `pnpm install --frozen-lockfile` then `pnpm build -- --concurrency=1`.
2. Each app's production server is `next start` (already its `start` script). Give each a port.

A root `ecosystem.config.js` (create when ready) looks like:

```js
module.exports = {
  apps: [
    { name: "bze-dex",     cwd: "./apps/dex",     script: "pnpm", args: "start -- -p 3001" },
    { name: "bze-burner",  cwd: "./apps/burner",  script: "pnpm", args: "start -- -p 3002" },
    { name: "bze-staking", cwd: "./apps/staking", script: "pnpm", args: "start -- -p 3003" },
  ],
};
```

Then `pm2 start ecosystem.config.js` and put nginx/Caddy in front routing each domain to its port.
Deploy flow: `git pull && pnpm install --frozen-lockfile && pnpm build -- --concurrency=1 && pm2 reload ecosystem.config.js`.
Only changed apps rebuild thanks to Turbo's cache.

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
