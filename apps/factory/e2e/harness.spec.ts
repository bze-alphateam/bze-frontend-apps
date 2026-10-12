import {expect, test} from "./support/mock-network";

// Self-checks of the network mock (e2e/support/mock-network.ts).

test("a request to a mocked host without a fixture is reported with its URL", async ({page, network}) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(network.takeUnmatched()).toEqual([]);

    const url = "https://lcd.e2e.test/bze/e2e/no_such_route?probe=1";
    const answer = await page.evaluate(async (target) => {
        const response = await fetch(target);
        return {status: response.status, body: await response.json()};
    }, url);

    expect(answer.status).toBe(500);
    expect(answer.body.message).toBe("no e2e fixture for GET /bze/e2e/no_such_route?probe=1");
    // Without this call the mock would fail the test in its teardown, listing the same URL.
    expect(network.takeUnmatched()).toEqual([`GET ${url}`]);
});

test("network.use answers ahead of the recorded fixtures", async ({page, network}) => {
    network.use("agg", {path: "/api/prices", status: 200, body: [{denom: "bzedge", price: 1, price_denom: "usd"}]});
    await page.goto("/");

    const body = await page.evaluate(async () => (await fetch("https://agg.e2e.test/api/prices")).json());
    expect(body).toEqual([{denom: "bzedge", price: 1, price_denom: "usd"}]);
});
