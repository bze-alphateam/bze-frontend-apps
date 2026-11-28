import {describe, expect, it, vi} from "vitest";
import type {Dao} from "@bze/bze-ui-kit";
import type {DaoListRequest} from "./dao-scan";
import type {ScanDao, ScanDaoList} from "./dao-types";
import {loadSubDaoCounts, loadSubDaos, subDaoOpenText, type SubDaoDeps} from "./dao-subdaos";

const ME = "bze1me";
const dao = (id: number, over: Partial<Dao> = {}): Dao => ({
    id: String(id), address: `bze1dao${id}`, admin: ME, pending_admin: "", type: "DAO_TYPE_STATIC_LIST", name: `Dao ${id}`,
    description: "", config: {} as Dao["config"], members: [], electorate: null, created_at: "1", admin_seq: "0", pending_admin_seq: "0", ...over,
});
const scanDao = (id: number, open: unknown): ScanDao => ({
    id, name: `Dao ${id}`, type: "static_list", address: `bze1dao${id}`, admin: ME, self_governed: false, created_time: null, proposals_open: open as number,
});
const list = (items: ScanDao[], next: string | null = null): ScanDaoList => ({items, next_cursor: next, supported: true, total: null});

function chainDeps(pages: Dao[][]) {
    const getDaosByAdmin = vi.fn(async (_admin: string, key: string | null) => {
        const i = key === null ? 0 : Number(key);
        return {items: pages[i] ?? [], nextKey: i + 1 < pages.length ? String(i + 1) : null};
    });
    const listDaos = vi.fn(async (): Promise<ScanDaoList> => list([]));
    return {chain: {getDaosByAdmin}, scan: {listDaos}} satisfies SubDaoDeps;
}

function scanDeps(answer: (request: DaoListRequest) => ScanDaoList | Promise<ScanDaoList>) {
    const listDaos = vi.fn(async (request: DaoListRequest) => answer(request));
    return {chain: {getDaosByAdmin: vi.fn(async () => ({items: [], nextKey: null}))}, scan: {listDaos}} satisfies SubDaoDeps;
}

describe("loadSubDaos", () => {
    it("none: a self-owned DAO lists itself under its own address, and is left out", async () => {
        const d = chainDeps([[dao(1, {address: ME, admin: ME})]]);
        expect(await loadSubDaos(d, {address: ME})).toEqual([]);
        expect(d.chain.getDaosByAdmin).toHaveBeenCalledWith(ME, null);
    });

    it("the DAOs it administers, from the chain alone", async () => {
        const d = chainDeps([[dao(3, {type: "DAO_TYPE_STAKE"}), dao(5)]]);
        expect(await loadSubDaos(d, {address: ME})).toEqual([
            {id: "3", name: "Dao 3", type: "DAO_TYPE_STAKE"},
            {id: "5", name: "Dao 5", type: "DAO_TYPE_STATIC_LIST"},
        ]);
        expect(d.scan.listDaos).not.toHaveBeenCalled();
    });

    it("reads every page the chain has", async () => {
        const d = chainDeps([[dao(1)], [dao(2)], [dao(3)]]);
        expect((await loadSubDaos(d, {address: ME})).map((r) => r.id)).toEqual(["1", "2", "3"]);
        expect(d.chain.getDaosByAdmin).toHaveBeenLastCalledWith(ME, "2");
    });

    it("a chain failure is thrown", async () => {
        const d: SubDaoDeps = {chain: {getDaosByAdmin: async () => { throw new Error("rest"); }}, scan: {listDaos: async () => list([])}};
        await expect(loadSubDaos(d, {address: ME})).rejects.toThrow("rest");
    });
});

describe("loadSubDaoCounts", () => {
    it("one Scan list filtered by admin gives each DAO's open count, by id", async () => {
        const d = scanDeps(() => list([scanDao(3, 2), scanDao(5, 0)]));
        const counts = await loadSubDaoCounts(d, {address: ME});
        expect(counts).toEqual(new Map([["3", 2], ["5", 0]]));
        expect(d.scan.listDaos).toHaveBeenCalledTimes(1);
        expect(d.scan.listDaos).toHaveBeenCalledWith({admin: ME, cursor: null, limit: 50});
    });

    it("pages through the list by cursor", async () => {
        const d = scanDeps((r) => (r.cursor ? list([scanDao(2, 1)]) : list([scanDao(1, 4)], "c1")));
        expect(await loadSubDaoCounts(d, {address: ME})).toEqual(new Map([["1", 4], ["2", 1]]));
        expect(d.scan.listDaos).toHaveBeenLastCalledWith({admin: ME, cursor: "c1", limit: 50});
    });

    it("a count that is not a number is left out", async () => {
        const d = scanDeps(() => list([scanDao(1, undefined), scanDao(2, "3")]));
        expect((await loadSubDaoCounts(d, {address: ME})).size).toBe(0);
    });

    it("Scan down is thrown (the rows do not depend on it)", async () => {
        const d = scanDeps(() => { throw new Error("down"); });
        await expect(loadSubDaoCounts(d, {address: ME})).rejects.toThrow("down");
    });
});

describe("subDaoOpenText", () => {
    it("says how many are being voted on", () => {
        expect(subDaoOpenText(3)).toBe("3 voting");
        expect(subDaoOpenText(1)).toBe("1 voting");
        expect(subDaoOpenText(0)).toBe("Nothing to vote on");
        expect(subDaoOpenText(null)).toBe("");
    });
});
