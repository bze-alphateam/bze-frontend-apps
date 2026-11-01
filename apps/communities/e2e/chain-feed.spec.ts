import type {Page} from "@playwright/test";
import {expect, test as base} from "./support/mock-network";
import {startFakeRpc, type FakeRpc} from "./support/fake-rpc";

// Chain feed specs (BFE-291). The app talks to a fake RPC on 127.0.0.1 (support/fake-rpc.ts)
// whose endpoint is written into the app's stored settings, because the default RPC host is
// closed by the network mock and routeWebSocket cannot intercept sockets of a SharedWorker.
// The live connection type shows in the wallet drawer's settings ("Connected" = events flow,
// "Polling" = no live feed).

const TOKEN_PAGE = "/token?denom=factory%2Fbze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l%2Fnoadmin";
const NEW_BLOCK = "tm.event='NewBlock'";
// The app's fallback poll (10 s) and every refresh (tab resume, catch-up after a recovery) re-fetch
// the aggregator tickers, which are not cached, so these requests count refreshes.
const TICKERS_URL = "https://agg.e2e.test/api/dex/tickers";
const POLLING_INTERVAL_MS = 10_000;
// storage key = <app storage version>-<chain id>:<settings key> (apps/communities/src/app/providers.tsx, .env.e2e)
const SETTINGS_KEY = "5-bzetestnet-3:bze_app_settings";

const test = base.extend<{rpc: FakeRpc}>({
    rpc: async ({context}, provide) => {
        const rpc = await startFakeRpc();
        await context.addInitScript(({key, endpoint}) => {
            const settings = {endpoints: {restEndpoint: "https://lcd.e2e.test", rpcEndpoint: endpoint}};
            window.localStorage.setItem(key, JSON.stringify({data: JSON.stringify(settings), expiry: 0}));
        }, {key: SETTINGS_KEY, endpoint: rpc.url});
        await provide(rpc);
        await rpc.close();
    },
});

/** Opens the token page and the wallet drawer's settings, which show the connection status. */
const openConnectionStatus = async (page: Page) => {
    await page.goto(TOKEN_PAGE);
    await page.locator("header").getByRole("button", {name: "Connect wallet"}).click();
    const drawer = page.getByRole("dialog", {name: "Your NoAdminToken wallet"});
    await drawer.getByRole("button", {name: "Settings"}).click();
    return drawer.getByTestId("settings-connection-status");
};

test("two tabs of one origin share a single socket to the node", async ({context, rpc}) => {
    const first = await openConnectionStatus(await context.newPage());
    const second = await openConnectionStatus(await context.newPage());

    await expect(first).toHaveText("Connected", {timeout: 15_000});
    await expect(second).toHaveText("Connected", {timeout: 15_000});
    expect(rpc.connections()).toBe(1);
    expect(rpc.subscribes(NEW_BLOCK)).toBe(1);
});

test("without SharedWorker the tab opens its own socket and is live", async ({context, rpc}) => {
    await context.addInitScript(() => {
        delete (window as unknown as {SharedWorker?: unknown}).SharedWorker;
    });

    const status = await openConnectionStatus(await context.newPage());

    await expect(status).toHaveText("Connected", {timeout: 15_000});
    expect(rpc.connections()).toBe(1);
});

test("a subscription the node cancels for capacity is subscribed again", async ({context, rpc}) => {
    rpc.cancelNextSubscribe();

    const status = await openConnectionStatus(await context.newPage());

    await expect(status).toHaveText("Connected", {timeout: 15_000});
    expect(rpc.subscribes(NEW_BLOCK)).toBeGreaterThanOrEqual(2);
});

/** Counts the refreshes the page made so far (see TICKERS_URL). */
const countRefreshes = (page: Page) => {
    let count = 0;
    page.on("request", (request) => {
        if (request.url().startsWith(TICKERS_URL)) count++;
    });
    return () => count;
};

const setVisibility = (page: Page, state: "hidden" | "visible") => page.evaluate((next) => {
    Object.defineProperty(document, "visibilityState", {configurable: true, get: () => next});
    document.dispatchEvent(new Event("visibilitychange"));
}, state);

test("many pages, opened and closed over time, keep a single socket to the node", async ({context, rpc}) => {
    const pages = [await context.newPage(), await context.newPage(), await context.newPage()];
    const statuses = [];
    for (const page of pages) statuses.push(await openConnectionStatus(page));
    for (const status of statuses) await expect(status).toHaveText("Connected", {timeout: 15_000});

    // the page that opened the connection goes away, a new one joins: the socket stays
    await pages[0].close();
    const late = await openConnectionStatus(await context.newPage());
    await expect(late).toHaveText("Connected", {timeout: 15_000});
    await expect(statuses[1]).toHaveText("Connected");

    expect(rpc.connections()).toBe(1);
    expect(rpc.subscribes(NEW_BLOCK)).toBe(1);
});

test("a refused socket falls back to polling, and the feed returns to live once the node accepts", async ({context, rpc}) => {
    const page = await context.newPage();
    await page.clock.install();
    const refreshes = countRefreshes(page);
    const status = await openConnectionStatus(page);
    await expect(status).toHaveText("Connected", {timeout: 15_000});

    rpc.setAvailable(false);
    await expect(status).toHaveText("Polling", {timeout: 15_000});

    // each poll interval refreshes once more; the page clock jumps instead of waiting
    const before = refreshes();
    await page.clock.runFor(POLLING_INTERVAL_MS);
    await expect.poll(refreshes).toBeGreaterThan(before);
    const afterFirstPoll = refreshes();
    await page.clock.runFor(POLLING_INTERVAL_MS);
    await expect.poll(refreshes).toBeGreaterThan(afterFirstPoll);
    await expect(status).toHaveText("Polling");

    // the worker reconnects with its own (real) backoff
    rpc.setAvailable(true);
    await expect(status).toHaveText("Connected", {timeout: 30_000});

    // the catch-up refresh lands, then polling is over
    await page.waitForTimeout(1_000);
    const settled = refreshes();
    await page.clock.runFor(3 * POLLING_INTERVAL_MS);
    await page.waitForTimeout(1_000);
    expect(refreshes()).toBe(settled);
    await expect(status).toHaveText("Connected");
});

test("a tab hidden for 30+ minutes refreshes once when shown again and stays live", async ({context, rpc}) => {
    const page = await context.newPage();
    await page.clock.install();
    const refreshes = countRefreshes(page);
    const status = await openConnectionStatus(page);
    await expect(status).toHaveText("Connected", {timeout: 15_000});

    await setVisibility(page, "hidden");
    await page.clock.fastForward(31 * 60_000);
    await page.waitForTimeout(1_000);
    const before = refreshes();

    await setVisibility(page, "visible");
    await expect.poll(refreshes).toBe(before + 1);
    await page.waitForTimeout(1_500);
    expect(refreshes()).toBe(before + 1);

    // still on the one socket and still live after the resume
    await expect(status).toHaveText("Connected");
    expect(rpc.connections()).toBe(1);
    expect(rpc.subscribes(NEW_BLOCK)).toBe(1);
});
