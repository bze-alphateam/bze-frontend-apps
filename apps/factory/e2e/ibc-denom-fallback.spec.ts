import {expect, test} from "./support/mock-network";

// A v8.2.0 node does not implement ibc-go v10's /denoms route (501), so the app must resolve the
// IBC token through the old /denom_traces route (fixtures/lcd/ibc.denom_trace.ulmn.json). The
// default fixtures answer the v10 route; here it is turned off. The harness fails the test if any
// route the app asks for has no fixture, so the old-route fixture is what keeps it resolving.

const HASH = "9DA252F9F9C86132CC282EA431DFB7DE7729501F6DC9A3E0F50EC8C6EE380CC7";
const ISSUER = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";

test("resolves the IBC token through the old denom_traces route when /denoms answers 501", async ({page, network}) => {
    network.use("lcd", {
        path: `/ibc/apps/transfer/v1/denoms/${HASH}`,
        status: 501,
        body: {code: 12, message: "Not Implemented", details: []},
    });

    const denomsRequest = page.waitForRequest((r) => r.url().includes(`/ibc/apps/transfer/v1/denoms/${HASH}`));
    const tracesRequest = page.waitForRequest((r) => r.url().includes(`/ibc/apps/transfer/v1/denom_traces/${HASH}`));
    await page.goto(`/market/new?base=${encodeURIComponent(`${ISSUER}/testusd`)}&quote=${encodeURIComponent(`ibc/${HASH}`)}`);
    await denomsRequest;
    await tracesRequest;

    await expect(page.getByRole("region", {name: "Pair"}).getByText("This pair already has a market.", {exact: true})).toBeVisible();
    expect(network.takeUnmatched()).toEqual([]);
});
