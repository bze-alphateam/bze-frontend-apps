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
// storage key = <app storage version>-<chain id>:<settings key> (apps/communities/src/app/providers.tsx, .env.e2e)
const SETTINGS_KEY = "5-bzetestnet-3:bze_app_settings";

const test = base.extend<{rpc: FakeRpc}>({
    rpc: async ({context}, use) => {
        const rpc = await startFakeRpc();
        await context.addInitScript(({key, endpoint}) => {
            const settings = {endpoints: {restEndpoint: "https://lcd.e2e.test", rpcEndpoint: endpoint}};
            window.localStorage.setItem(key, JSON.stringify({data: JSON.stringify(settings), expiry: 0}));
        }, {key: SETTINGS_KEY, endpoint: rpc.url});
        await use(rpc);
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
