import {describe, expect, it, vi} from "vitest";
import {createDaoPageScan} from "./dao-page-scan";
import {ScanUnavailableError, type ScanGetter} from "./dao-scan";

const getter = (status: number, body: unknown): ScanGetter => vi.fn(async () => ({status, body}));

describe("createDaoPageScan", () => {
    it("daoDetail: the body, null for a DAO Scan does not know, an error for anything else", async () => {
        expect(await createDaoPageScan(getter(200, {id: 2, creator: "bze1c"})).daoDetail("2")).toMatchObject({creator: "bze1c"});
        expect(await createDaoPageScan(getter(404, {})).daoDetail("2")).toBeNull();
        await expect(createDaoPageScan(getter(502, {})).daoDetail("2")).rejects.toBeInstanceOf(ScanUnavailableError);
        await expect(createDaoPageScan(vi.fn(async () => { throw new Error("offline"); })).daoDetail("2")).rejects.toBeInstanceOf(ScanUnavailableError);
    });

    it("history: reads the path, the cursor and the next cursor; no total by cursor", async () => {
        const get = getter(200, {items: [{type: "EventDaoCreated"}], next_cursor: "c2"});
        const page = await createDaoPageScan(get).history("2", {cursor: "c1"}, 20);
        expect(get).toHaveBeenCalledWith("daos/2/history", [["cursor", "c1"], ["limit", "20"]]);
        expect(page).toEqual({items: [{type: "EventDaoCreated"}], next_cursor: "c2", total: null});
    });

    it("history: a numbered page (never with a cursor) and its total", async () => {
        const get = getter(200, {items: [], next_cursor: null, total: 23});
        const page = await createDaoPageScan(get).history("2", {page: 2, cursor: "ignored"}, 20);
        expect(get).toHaveBeenCalledWith("daos/2/history", [["page", "2"], ["limit", "20"]]);
        expect(page.total).toBe(23);
    });

    it("history: an error answer or a body without items is unavailable", async () => {
        await expect(createDaoPageScan(getter(500, {})).history("2")).rejects.toBeInstanceOf(ScanUnavailableError);
        await expect(createDaoPageScan(getter(200, {oops: 1})).history("2")).rejects.toBeInstanceOf(ScanUnavailableError);
    });

    it("votesByVoter: asks for the voter's votes", async () => {
        const get = getter(200, {items: [], next_cursor: null, supported: true});
        await createDaoPageScan(get).votesByVoter("bze1me", null, 100);
        expect(get).toHaveBeenCalledWith("dao-votes", [["voter", "bze1me"], ["limit", "100"]]);
    });
});
