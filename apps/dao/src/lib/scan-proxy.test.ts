import {beforeEach, describe, expect, it, vi} from "vitest";
import {createScanProxyHandler, type Fetcher} from "./scan-proxy";

const BASE = "https://scan.test";

let fetcher: ReturnType<typeof vi.fn<Fetcher>>;
let GET: ReturnType<typeof createScanProxyHandler>["GET"];

const ok = (body: unknown) => new Response(JSON.stringify(body), {status: 200});
const call = (path: string, search = "") =>
    GET(new Request(`https://dao.test/api/scan/${path}${search}`), {params: Promise.resolve({path: path.split("/")})});

beforeEach(() => {
    fetcher = vi.fn<Fetcher>();
    ({GET} = createScanProxyHandler({baseUrl: `${BASE}/`, fetcher}));
});

describe("DAO scan proxy", () => {
    it("forwards the DAO list with its own parameters, repeated ones kept", async () => {
        fetcher.mockResolvedValue(ok({items: []}));
        const res = await call("daos", "?type=stake&q=club&source=sr%2F1&source=dr%2Ffactory%2Fbze1x%2Fu&evil=1&limit=20");

        expect(fetcher).toHaveBeenCalledWith(
            `${BASE}/api/v1/daos?type=stake&q=club&source=sr%2F1&source=dr%2Ffactory%2Fbze1x%2Fu&limit=20`,
            expect.anything(),
        );
        expect(res.status).toBe(200);
        expect(res.headers.get("Cache-Control")).toBe("no-store");
    });

    it("forwards the page of the DAO list", async () => {
        fetcher.mockResolvedValue(ok({items: [], total: 0}));
        await call("daos", "?page=2&limit=20&type=stake");
        expect(fetcher).toHaveBeenCalledWith(`${BASE}/api/v1/daos?type=stake&page=2&limit=20`, expect.anything());
    });

    it("forwards the repeated status of a DAO's proposals", async () => {
        fetcher.mockResolvedValue(ok({items: []}));
        await call("daos/4/proposals", "?status=voting&status=execution_failed");
        expect(fetcher).toHaveBeenCalledWith(`${BASE}/api/v1/daos/4/proposals?status=voting&status=execution_failed`, expect.anything());
    });

    it("answers 404 for a route that is not a DAO route, without calling Scan", async () => {
        for (const path of ["proposals", "daos/abc", "accounts/bze1x", "dao-proposals/1/evil", "dao-proposals"]) {
            expect((await call(path)).status).toBe(404);
        }
        expect(fetcher).not.toHaveBeenCalled();
    });

    it("passes Scan's 400 through and maps other failures to 502", async () => {
        fetcher.mockResolvedValueOnce(new Response('{"error":"member is not a bze1 address"}', {status: 400}));
        expect((await call("daos", "?member=x")).status).toBe(400);

        fetcher.mockResolvedValueOnce(new Response("boom", {status: 500}));
        expect((await call("daos")).status).toBe(502);

        fetcher.mockRejectedValueOnce(new Error("down"));
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        expect((await call("daos")).status).toBe(502);
    });

    it("always re-reads a proposal that is still open", async () => {
        fetcher.mockImplementation(async () => ok({id: 5, status: "voting"}));
        await call("dao-proposals/5");
        const again = await call("dao-proposals/5");

        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(again.headers.get("Cache-Control")).toBe("no-store");
    });

    it("re-reads an execution_failed proposal: a retry can still change it", async () => {
        fetcher.mockImplementation(async () => ok({id: 6, status: "execution_failed"}));
        await call("dao-proposals/6");
        await call("dao-proposals/6");
        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it("keeps a finished, cleaned-up proposal for good and marks it immutable", async () => {
        fetcher.mockImplementation(async () => ok({id: 7, status: "executed", cleaned_height: 900}));
        await call("dao-proposals/7");
        const again = await call("dao-proposals/7");

        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(again.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
        expect(await again.json()).toEqual({id: 7, status: "executed", cleaned_height: 900});
    });

    it("re-reads a finished proposal the chain has not cleaned up yet: the cleanup is still to come", async () => {
        fetcher.mockImplementation(async () => ok({id: 7, status: "executed", cleaned_height: null}));
        await call("dao-proposals/7");
        const again = await call("dao-proposals/7");

        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(again.headers.get("Cache-Control")).toBe("no-store");
    });

    it("drops a votes option Scan does not know, keeping the paging", async () => {
        fetcher.mockImplementation(async () => ok({items: []}));
        await call("dao-proposals/7/votes", "?option=VOTE_OPTION_YES&limit=20");
        expect(fetcher).toHaveBeenCalledWith(`${BASE}/api/v1/dao-proposals/7/votes?limit=20`, expect.anything());
        await call("dao-proposals/7/votes", "?option=abstain");
        expect(fetcher).toHaveBeenLastCalledWith(`${BASE}/api/v1/dao-proposals/7/votes?option=abstain`, expect.anything());
    });

    it("forwards the option filter and paging of a proposal's votes", async () => {
        fetcher.mockImplementation(async () => ok({items: []}));
        await call("dao-proposals/7/votes", "?option=yes&cursor=abc&limit=20&evil=1");
        expect(fetcher).toHaveBeenCalledWith(`${BASE}/api/v1/dao-proposals/7/votes?option=yes&cursor=abc&limit=20`, expect.anything());
    });

    it("never keeps a list, even one of finished proposals", async () => {
        fetcher.mockImplementation(async () => ok({items: [{id: 7, status: "executed"}]}));
        await call("daos/4/proposals", "?status=executed&cursor=abc");
        await call("daos/4/proposals", "?status=executed&cursor=abc");
        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it("does not keep a placeholder proposal whose status is null", async () => {
        fetcher.mockImplementation(async () => ok({id: 8, status: null}));
        await call("dao-proposals/8");
        await call("dao-proposals/8");
        expect(fetcher).toHaveBeenCalledTimes(2);
    });
});
