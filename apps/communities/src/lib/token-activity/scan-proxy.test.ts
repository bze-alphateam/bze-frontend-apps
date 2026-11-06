import {describe, expect, it, vi} from "vitest";

import {createScanProxyHandler} from "./scan-proxy";

const ADDRESS = "bze1fkj4ngtlqcxs83q360fl6f8jn8phzh4y6y3y5k";
const HASH = "8E56E5C0AC8A84FF0F0D6175ECC6784AAA74E2E285C4F644EE156100DBAEF595";

const call = (handler: ReturnType<typeof createScanProxyHandler>, path: string, query = "") =>
    handler.GET(new Request(`http://localhost/api/scan/${path}${query}`), {params: Promise.resolve({path: path.split("/")})});

const scan = (body: unknown, status = 200, cacheControl?: string) =>
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {status, headers: cacheControl ? {"Cache-Control": cacheControl} : {}}));

describe("createScanProxyHandler", () => {
    it.each([
        ["token", "?denom=factory%2Fbze1x%2Fuabc&evil=1", "/api/v1/token?denom=factory%2Fbze1x%2Fuabc"],
        ["token/transfers", "?denom=ubze&cursor=NDA%3D&limit=100", "/api/v1/token/transfers?denom=ubze&cursor=NDA%3D&limit=100"],
        ["token/events", "?denom=ubze", "/api/v1/token/events?denom=ubze"],
        ["token/holders", "?denom=ubze&limit=25", "/api/v1/token/holders?denom=ubze&limit=25"],
        [`accounts/${ADDRESS}`, "?denom=ubze", `/api/v1/accounts/${ADDRESS}`],
        [`accounts/${ADDRESS}/activity`, "?denom=ubze&page=2&limit=25", `/api/v1/accounts/${ADDRESS}/activity?denom=ubze&page=2&limit=25`],
        [`txs/${HASH}`, "", `/api/v1/txs/${HASH}`],
        ["modules", "", "/api/v1/modules"],
    ])("forwards %s with its own parameters only", async (path, query, target) => {
        const fetcher = scan({});
        await call(createScanProxyHandler({baseUrl: "https://scan.test/", fetcher}), path, query);

        expect(fetcher.mock.calls[0][0]).toBe(`https://scan.test${target}`);
    });

    it.each(["blocks", "txs/xyz", "accounts/cosmos1abc", "token/transfers/extra", "registry/assets"])("refuses %s", async (path) => {
        const fetcher = scan({});
        const response = await call(createScanProxyHandler({baseUrl: "https://scan.test", fetcher}), path);

        expect(response.status).toBe(404);
        expect(fetcher).not.toHaveBeenCalled();
    });

    it("passes Scan's Cache-Control on a 200, no-store without one", async () => {
        const cached = await call(createScanProxyHandler({baseUrl: "https://scan.test", fetcher: scan({hash: HASH}, 200, "public, max-age=60")}), `txs/${HASH}`);
        const plain = await call(createScanProxyHandler({baseUrl: "https://scan.test", fetcher: scan({items: []})}), "modules");

        expect([cached.status, cached.headers.get("Cache-Control"), await cached.json()]).toEqual([200, "public, max-age=60", {hash: HASH}]);
        expect(plain.headers.get("Cache-Control")).toBe("no-store");
    });

    it("keeps Scan's 400 and 404, turns any other failure into a 502", async () => {
        const notFound = await call(createScanProxyHandler({baseUrl: "https://scan.test", fetcher: scan({error: {code: "not_found"}}, 404)}), `txs/${HASH}`);
        const broken = await call(createScanProxyHandler({baseUrl: "https://scan.test", fetcher: scan({error: {code: "internal"}}, 500)}), "modules");
        const down = await call(createScanProxyHandler({baseUrl: "https://scan.test", fetcher: vi.fn().mockRejectedValue(new Error("down"))}), "modules");

        expect([notFound.status, broken.status, down.status]).toEqual([404, 502, 502]);
        expect(await down.json()).toEqual({error: {code: "upstream_error", message: "BZE Scan unavailable"}});
        expect(down.headers.get("Cache-Control")).toBe("no-store");
    });
});
