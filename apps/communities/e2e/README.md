# Communities e2e tests

Playwright specs that drive a production build of the communities app in Chromium. Every call to the chain (LCD), the aggregator and the RPC goes to a fake `*.e2e.test` host and is answered from recorded JSON fixtures, so a run never touches a real node.

**They run in CI only**, in the `e2e-communities` workflow (`.github/workflows/e2e-communities.yml`), a separate check from `ci.yml`. It runs on pull requests to `develop`/`main` that touch `apps/communities/**`, `packages/ui-kit/**` or `pnpm-lock.yaml`. On a failure, download the `playwright-report` artifact of the run: it holds the HTML report with a trace and a screenshot for each failed test.

## Layout

| Path | What it is |
|---|---|
| `../playwright.config.ts` | Chromium only, `baseURL http://localhost:3004`, starts `next start -p 3004` on the e2e build |
| `../.env.e2e` | Build env: testnet chain settings with `lcd.e2e.test`, `rpc.e2e.test`, `agg.e2e.test` as hosts, cross-chain (Skip) off |
| `support/mock-network.ts` | The `test` to import in every spec: answers the fake hosts from `fixtures/`, fails the test on a request no fixture covers |
| `support/record-fixture.mjs` | Records one fixture from testnet |
| `fixtures/lcd/`, `fixtures/agg/` | One JSON file per answered request (see `fixtures/README.md`) |
| `*.spec.ts` | The specs |

## Commands

From the repo root:

```bash
pnpm --filter @bze/bze-ui-kit build
pnpm --filter bze-communities e2e:build
pnpm --filter bze-communities exec playwright install --with-deps chromium
pnpm --filter bze-communities e2e
```

`e2e:build` builds the app with `.env.e2e` (it overwrites `.next`). `e2e:typecheck` type-checks the specs; the app's own `tsconfig.json` leaves `e2e/` out, so `next build` never compiles them.

## How the network mock works

- Each fixture is keyed by method, path and query. Query order does not matter, but every parameter does, including the empty `pagination.key=` the LCD client always sends.
- A request to `lcd.e2e.test` or `agg.e2e.test` that no fixture covers gets a 500 answer. The test then fails in its teardown with `requests to mocked hosts without a fixture`, followed by every such URL.
- The RPC WebSocket (`wss://rpc.e2e.test`) is closed as soon as it opens. The app has to render without block/tx events.
- `chain-feed.spec.ts` is the exception: it runs a fake RPC on 127.0.0.1 (`support/fake-rpc.ts`) and stores its address in the app settings, because `routeWebSocket` cannot intercept sockets opened inside a SharedWorker.
- Requests to any other non-local host (token logos, wallet SDKs) are aborted and listed in the test's annotations (`blocked external request`). They never fail a test.
- `network.use(host, fixture)` answers a request differently for one test, ahead of the recorded fixtures. Use it for empty, error or edge-case answers:

  ```ts
  test("shows the empty state", async ({page, network}) => {
      network.use("agg", {path: "/api/dex/tickers", status: 200, body: []});
      await page.goto("/");
  });
  ```

## Adding a fixture

1. Run the spec in CI (or read the failing run's log): the failure lists each missing URL, e.g. `GET https://lcd.e2e.test/bze/rewards/denom_reward?denom=factory%2F...`.
2. Record it from testnet (the script swaps `lcd.e2e.test` for `https://testnet.getbze.com` and `agg.e2e.test` for `https://getbze.com`):

   ```bash
   cd apps/communities
   node e2e/support/record-fixture.mjs 'https://lcd.e2e.test/bze/rewards/denom_reward?denom=factory%2F...' rewards.denom_reward.mytoken
   ```

   The file lands in `e2e/fixtures/<lcd|agg>/<name>.json`. Copy the URL exactly, query included.
3. Trim the `body` to what the specs need, and say what you removed in a `"trimmed"` field.
4. Add a line for it to `fixtures/README.md`.

To make up an answer testnet does not have (a brand kit, a raffle, an error), write the envelope by hand with `"source": "synthetic"`, or use `network.use` if only one spec needs it.

## Adding a spec

1. Create `e2e/<feature>.spec.ts` and import `test` and `expect` from `./support/mock-network`, never from `@playwright/test`. Otherwise the network is not mocked and the app calls the real `*.e2e.test` hosts, which do not exist.
2. Open pages by URL (`page.goto("/token?denom=...")`) and assert on what a user sees: roles, labels, text.
3. Wallet-connected flows are out of reach (there is no wallet extension in the browser). Cover them with unit tests in `src/`.
4. Run `pnpm --filter bze-communities e2e:typecheck` and `lint`, push, and let the `e2e-communities` check run the suite.
