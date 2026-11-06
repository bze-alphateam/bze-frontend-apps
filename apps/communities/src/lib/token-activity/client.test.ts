import {describe, expect, it, vi} from "vitest";

import {createScanClient, ScanError} from "./client";

const ok = (body: unknown) => new Response(JSON.stringify(body), {status: 200});

describe("createScanClient", () => {
    it("asks the app's Scan route with the denom URL-encoded in the query", async () => {
        const fetcher = vi.fn().mockResolvedValue(ok({items: [], next_cursor: null}));
        const client = createScanClient({fetcher});

        await client.tokenTransfers("factory/bze1x/uabc", {cursor: "NDA=", limit: 100});
        await client.token("factory/bze1x/uabc");
        await client.accountActivity("bze1abc", {denom: "ubze", limit: 25});
        await client.tx("AB".repeat(32));
        await client.modules();

        expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
            "/api/scan/token/transfers?denom=factory%2Fbze1x%2Fuabc&cursor=NDA%3D&limit=100",
            "/api/scan/token?denom=factory%2Fbze1x%2Fuabc",
            "/api/scan/accounts/bze1abc/activity?denom=ubze&limit=25",
            `/api/scan/txs/${"AB".repeat(32)}`,
            "/api/scan/modules",
        ]);
    });

    it("leaves out empty parameters and honours another base", async () => {
        const fetcher = vi.fn().mockResolvedValue(ok({items: [], next_cursor: null}));

        await createScanClient({baseUrl: "https://scan.test/api/v1/", fetcher}).tokenHolders("ubze", {cursor: null});

        expect(fetcher).toHaveBeenCalledWith("https://scan.test/api/v1/token/holders?denom=ubze", {signal: undefined});
    });

    it("turns Scan's error answer into a ScanError with its status", async () => {
        const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({error: {code: "not_found", message: "transaction not found"}}), {status: 404}));

        const error = await createScanClient({fetcher}).tx("AB".repeat(32)).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ScanError);
        expect(error).toMatchObject({status: 404, isNotFound: true, message: "transaction not found"});
    });

    it("reports an unreachable Scan as status 0, and a body that isn't JSON", async () => {
        const down = createScanClient({fetcher: vi.fn().mockRejectedValue(new TypeError("failed"))});
        const html = createScanClient({fetcher: vi.fn().mockResolvedValue(new Response("<html>", {status: 502}))});

        await expect(down.modules()).rejects.toMatchObject({status: 0});
        await expect(html.modules()).rejects.toMatchObject({status: 502});
    });
});
