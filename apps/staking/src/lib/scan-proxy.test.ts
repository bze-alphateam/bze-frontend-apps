import { describe, it, expect, vi, beforeEach } from "vitest";
import detail48 from "./governance/fixtures/scan-proposal-48.json";
import page from "./governance/fixtures/scan-proposals-page.json";
import { createScanProxyHandler, type Fetcher } from "./scan-proxy";

// The /api/scan route against a fake BZE Scan: what it forwards, and that only
// decided proposals are kept.
const BASE = "https://scan.test";
const passed47 = { ...detail48, id: 47, status: "passed" };
const finalPage = { items: page.items.slice(1), next_cursor: "NDY" };

let fetcher: ReturnType<typeof vi.fn<Fetcher>>;
let GET: ReturnType<typeof createScanProxyHandler>["GET"];

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const call = (path: string, search = "") =>
    GET(new Request(`https://staking.test/api/scan/${path}${search}`), { params: Promise.resolve({ path: path.split("/") }) });

beforeEach(() => {
    fetcher = vi.fn<Fetcher>();
    ({ GET } = createScanProxyHandler({ baseUrl: `${BASE}/`, fetcher }));
});

describe("scan proxy", () => {
    it("forwards the proposal list with only its own query parameters", async () => {
        fetcher.mockResolvedValue(ok(page));
        const res = await call("proposals", "?status=voting_period&limit=50&evil=1");

        expect(fetcher).toHaveBeenCalledWith(`${BASE}/api/v1/proposals?status=voting_period&limit=50`, expect.anything());
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual(page);
    });

    it("always re-reads an open proposal", async () => {
        fetcher.mockImplementation(async () => ok(detail48));
        const first = await call("proposals/48");
        await call("proposals/48");

        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(first.headers.get("Cache-Control")).toBe("no-store");
    });

    it("keeps a decided proposal for good and marks it immutable", async () => {
        fetcher.mockImplementation(async () => ok(passed47));
        await call("proposals/47");
        const again = await call("proposals/47");

        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(again.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
        expect(await again.json()).toEqual(passed47);
    });

    it("keeps an older page of decided proposals, but never the first page", async () => {
        fetcher.mockImplementation(async () => ok(finalPage));
        await call("proposals", "?limit=10");
        await call("proposals", "?limit=10");
        expect(fetcher).toHaveBeenCalledTimes(2);

        await call("proposals", "?cursor=NDc&limit=10");
        await call("proposals", "?cursor=NDc&limit=10");
        expect(fetcher).toHaveBeenCalledTimes(3);
    });

    it("re-reads an older page while it holds an open proposal", async () => {
        fetcher.mockImplementation(async () => ok(page));
        await call("proposals", "?cursor=NDk&limit=10");
        await call("proposals", "?cursor=NDk&limit=10");

        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it("drops the oldest answer past its size", async () => {
        ({ GET } = createScanProxyHandler({ baseUrl: BASE, fetcher, maxEntries: 1 }));
        fetcher.mockImplementation(async (url) => ok({ ...passed47, id: Number(url.split("/").pop()) }));
        await call("proposals/47");
        await call("proposals/46");
        await call("proposals/47");

        expect(fetcher).toHaveBeenCalledTimes(3);
    });

    it("refuses any other path without asking Scan", async () => {
        for (const path of ["blocks", "proposals/48/votes", "proposals/abc"]) {
            expect((await call(path)).status).toBe(404);
        }
        expect(fetcher).not.toHaveBeenCalled();
    });

    it("passes a 404 on, and answers 502 when Scan fails or is unreachable", async () => {
        fetcher.mockResolvedValueOnce(new Response('{"error":"not found"}', { status: 404 }));
        expect((await call("proposals/999")).status).toBe(404);

        fetcher.mockResolvedValueOnce(new Response("oops", { status: 500 }));
        expect((await call("proposals/48")).status).toBe(502);

        vi.spyOn(console, "error").mockImplementation(() => {});
        fetcher.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
        const res = await call("proposals/48");
        expect(res.status).toBe(502);
        expect(res.headers.get("Cache-Control")).toBe("no-store");
    });
});
