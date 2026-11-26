import {beforeEach, describe, expect, it, vi} from "vitest";
import {createScanProxyHandler, type Fetcher} from "./scan-proxy";

const BASE = "https://scan.test";

let fetcher: ReturnType<typeof vi.fn<Fetcher>>;
let GET: ReturnType<typeof createScanProxyHandler>["GET"];

const call = (path: string, search = "") =>
    GET(new Request(`https://dex.test/api/scan/${path}${search}`), {params: Promise.resolve({path: path.split("/")})});

beforeEach(() => {
    fetcher = vi.fn<Fetcher>();
    ({GET} = createScanProxyHandler({baseUrl: `${BASE}/`, fetcher}));
});

describe("DEX scan proxy", () => {
    it("forwards the DAO list with its allowed parameters, repeated ones kept", async () => {
        fetcher.mockResolvedValue(new Response('{"items":[]}', {status: 200}));
        const res = await call("daos", "?source=sr%2F1&source=dr%2Fubze&evil=1&limit=50");

        expect(fetcher).toHaveBeenCalledWith(`${BASE}/api/v1/daos?source=sr%2F1&source=dr%2Fubze&limit=50`, expect.anything());
        expect(res.status).toBe(200);
        expect(res.headers.get("Cache-Control")).toBe("no-store");
        expect(await res.json()).toEqual({items: []});
    });

    it("forwards the open-proposals feed", async () => {
        fetcher.mockResolvedValue(new Response('{"items":[]}', {status: 200}));
        await call("dao-proposals", "?status=voting&cursor=abc&evil=1");
        expect(fetcher).toHaveBeenCalledWith(`${BASE}/api/v1/dao-proposals?status=voting&cursor=abc`, expect.anything());
    });

    it("answers 404 for any other route, without calling Scan", async () => {
        for (const path of ["proposals", "daos/1", "dao-proposals/1", "accounts/bze1x", "token"]) {
            expect((await call(path)).status).toBe(404);
        }
        expect(fetcher).not.toHaveBeenCalled();
    });

    it("passes Scan's 400 and 404 through and maps other failures to 502", async () => {
        fetcher.mockResolvedValueOnce(new Response('{"error":"member is not a bze1 address"}', {status: 400}));
        expect((await call("daos", "?member=x")).status).toBe(400);

        fetcher.mockResolvedValueOnce(new Response("nope", {status: 404}));
        expect((await call("dao-proposals")).status).toBe(404);

        fetcher.mockResolvedValueOnce(new Response("boom", {status: 500}));
        expect((await call("daos")).status).toBe(502);

        fetcher.mockRejectedValueOnce(new Error("down"));
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        expect((await call("daos")).status).toBe(502);
    });
});
