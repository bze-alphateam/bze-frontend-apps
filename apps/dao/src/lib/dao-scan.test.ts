import {describe, expect, it, vi} from "vitest";
import {createDaoScanClient, ScanUnavailableError, type ScanGetter} from "./dao-scan";

const client = (get: ScanGetter) => createDaoScanClient(get);

describe("filtersSupported", () => {
    it("is true when Scan refuses the invalid member address", async () => {
        const get = vi.fn<ScanGetter>(async () => ({status: 400, body: {error: "bad"}}));
        expect(await client(get).filtersSupported()).toBe("yes");
        expect(get).toHaveBeenCalledWith("daos", [["member", "not-an-address"], ["limit", "1"]]);
    });

    it("is false when Scan ignores the unknown parameter and answers the whole list", async () => {
        const get = vi.fn<ScanGetter>(async () => ({status: 200, body: {items: [], supported: true}}));
        expect(await client(get).filtersSupported()).toBe("no");
    });

    it("is unknown, not 'no', when the probe fails or Scan answers 5xx, and asks again next time", async () => {
        const get = vi.fn<ScanGetter>()
            .mockRejectedValueOnce(new Error("down"))
            .mockResolvedValueOnce({status: 502, body: null})
            .mockResolvedValueOnce({status: 400, body: {error: "bad"}});
        const c = client(get);

        expect(await c.filtersSupported()).toBe("unknown");
        expect(await c.filtersSupported()).toBe("unknown");
        expect(await c.filtersSupported()).toBe("yes");
        expect(get).toHaveBeenCalledTimes(3);
    });

    it("remembers a definite answer", async () => {
        const get = vi.fn<ScanGetter>(async () => ({status: 400, body: null}));
        const c = client(get);
        await c.filtersSupported();
        await c.filtersSupported();
        expect(get).toHaveBeenCalledTimes(1);
    });
});

describe("listDaos", () => {
    it("sends the filters, repeating the source", async () => {
        const get = vi.fn<ScanGetter>(async () => ({status: 200, body: {items: [], next_cursor: null, supported: true}}));
        await client(get).listDaos({type: "stake", q: "x", member: "bze1m", sources: ["sr/1", "dr/ubze"], cursor: "c", limit: 5});
        expect(get).toHaveBeenCalledWith("daos", [
            ["type", "stake"], ["q", "x"], ["member", "bze1m"], ["source", "sr/1"], ["source", "dr/ubze"], ["cursor", "c"], ["limit", "5"],
        ]);
    });

    it("reads an answer without the supported flag as supported", async () => {
        const get = vi.fn<ScanGetter>(async () => ({status: 200, body: {items: [], next_cursor: ""}}));
        expect(await client(get).listDaos({})).toEqual({items: [], next_cursor: null, supported: true});
    });

    it("throws ScanUnavailableError on an error status, a thrown fetch and a body without items", async () => {
        await expect(client(async () => ({status: 502, body: null})).listDaos({})).rejects.toBeInstanceOf(ScanUnavailableError);
        await expect(client(async () => { throw new Error("net"); }).listDaos({})).rejects.toBeInstanceOf(ScanUnavailableError);
        await expect(client(async () => ({status: 200, body: {nope: 1}})).listDaos({})).rejects.toBeInstanceOf(ScanUnavailableError);
    });
});

describe("openProposals", () => {
    it("asks for the voting proposals", async () => {
        const get = vi.fn<ScanGetter>(async () => ({status: 200, body: {items: [], next_cursor: null}}));
        await client(get).openProposals(null, 10);
        expect(get).toHaveBeenCalledWith("dao-proposals", [["status", "voting"], ["limit", "10"]]);
    });
});
