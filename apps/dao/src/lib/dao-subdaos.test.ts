import {describe, expect, it, vi} from "vitest";
import type {Dao} from "@bze/bze-ui-kit";
import type {ScanDaoDetail} from "./dao-types";
import {loadSubDaos, subDaoOpenText, type SubDaoDeps} from "./dao-subdaos";

const ME = "bze1me";
const dao = (id: number, over: Partial<Dao> = {}): Dao => ({
    id: String(id), address: `bze1dao${id}`, admin: ME, pending_admin: "", type: "DAO_TYPE_STATIC_LIST", name: `Dao ${id}`,
    description: "", config: {} as Dao["config"], members: [], electorate: null, created_at: "1", admin_seq: "0", pending_admin_seq: "0", ...over,
});
const detail = (open?: number): ScanDaoDetail => ({proposals_open: open} as ScanDaoDetail);

function deps(pages: Dao[][], daoDetail: SubDaoDeps["scan"]["daoDetail"] = async (id) => detail(Number(id))): SubDaoDeps & {getDaosByAdmin: ReturnType<typeof vi.fn>} {
    const getDaosByAdmin = vi.fn(async (_admin: string, key: string | null) => {
        const i = key === null ? 0 : Number(key);
        return {items: pages[i] ?? [], nextKey: i + 1 < pages.length ? String(i + 1) : null};
    });
    return {chain: {getDaosByAdmin}, scan: {daoDetail}, getDaosByAdmin};
}

describe("loadSubDaos", () => {
    it("none: a self-owned DAO lists itself under its own address, and is left out", async () => {
        const d = deps([[dao(1, {address: ME, admin: ME})]]);
        expect(await loadSubDaos(d, {address: ME})).toEqual([]);
        expect(d.getDaosByAdmin).toHaveBeenCalledWith(ME, null);
    });

    it("the DAOs it administers, with each one's open proposals from Scan", async () => {
        const d = deps([[dao(3, {type: "DAO_TYPE_STAKE"}), dao(0), dao(5)]]);
        expect(await loadSubDaos(d, {address: ME})).toEqual([
            {id: "3", name: "Dao 3", type: "DAO_TYPE_STAKE", open: 3},
            {id: "0", name: "Dao 0", type: "DAO_TYPE_STATIC_LIST", open: 0},
            {id: "5", name: "Dao 5", type: "DAO_TYPE_STATIC_LIST", open: 5},
        ]);
    });

    it("reads every page the chain has", async () => {
        const d = deps([[dao(1)], [dao(2)], [dao(3)]]);
        expect((await loadSubDaos(d, {address: ME})).map((r) => r.id)).toEqual(["1", "2", "3"]);
        expect(d.getDaosByAdmin).toHaveBeenLastCalledWith(ME, "2");
    });

    it("Scan down, unaware of a DAO, or older (no count): the count is left out, never the row", async () => {
        const d = deps([[dao(1), dao(2), dao(3)]], async (id) => {
            if (id === "1") throw new Error("down");
            return id === "2" ? null : detail(undefined);
        });
        expect((await loadSubDaos(d, {address: ME})).map((r) => r.open)).toEqual([null, null, null]);
    });

    it("a chain failure is thrown", async () => {
        const d: SubDaoDeps = {chain: {getDaosByAdmin: async () => { throw new Error("rest"); }}, scan: {daoDetail: async () => null}};
        await expect(loadSubDaos(d, {address: ME})).rejects.toThrow("rest");
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
