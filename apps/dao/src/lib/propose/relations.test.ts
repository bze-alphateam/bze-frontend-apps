import {describe, expect, it, vi} from "vitest";
import type {Dao} from "@bze/bze-ui-kit";
import {ScanUnavailableError} from "../dao-scan";
import {CONFIG, DAO_ADDRESS, OTHER, SUB_ADDRESS, THIRD} from "@/test/composer-fixtures";
import {createRelationScan, loadRelations, type RelationChain, type RelationDeps, type RelationScan} from "./relations";

const dao = (over: Partial<Dao> = {}): Dao => ({
    id: "7", address: SUB_ADDRESS, admin: DAO_ADDRESS, pending_admin: "", type: "DAO_TYPE_STATIC_LIST", name: "Garden club", description: "",
    config: CONFIG, members: [OTHER], electorate: null, created_at: "0", admin_seq: "0", pending_admin_seq: "0", ...over,
});

const chain = (over: Partial<RelationChain> = {}): RelationChain => ({
    getDao: vi.fn(async () => null),
    getDaosByAdmin: vi.fn(async () => ({items: [], nextKey: null})),
    getBalances: vi.fn(async () => [{denom: "ubze", amount: "5"}]),
    getStakeOptions: vi.fn(async () => []),
    ...over,
});
const scan = (over: Partial<RelationScan> = {}): RelationScan => ({daosNominating: vi.fn(async () => []), ...over});
const deps = (c: Partial<RelationChain> = {}, s: Partial<RelationScan> = {}): RelationDeps => ({chain: chain(c), scan: scan(s)});
const me = {address: DAO_ADDRESS, type: "DAO_TYPE_STATIC_LIST" as const};

describe("the sub-DAOs", () => {
    it("lists the DAOs the DAO administers with their treasuries, leaving out the DAO itself (a self-owned DAO is listed under its own address)", async () => {
        const self = dao({id: "4", address: DAO_ADDRESS, admin: DAO_ADDRESS});
        const result = await loadRelations(deps({getDaosByAdmin: async () => ({items: [self, dao()], nextKey: null})}), me);
        expect(result.subDaos).toEqual([{dao: dao(), treasury: [{denom: "ubze", amount: "5"}]}]);
    });

    it("reads every page", async () => {
        const getDaosByAdmin = vi.fn(async (_admin: string, key: string | null) => (key === null
            ? {items: [dao({id: "7"})], nextKey: "k2"}
            : {items: [dao({id: "8", address: THIRD})], nextKey: null}));
        const result = await loadRelations(deps({getDaosByAdmin}), me);
        expect(result.subDaos?.map((s) => s.dao.id)).toEqual(["7", "8"]);
        expect(getDaosByAdmin).toHaveBeenCalledWith(DAO_ADDRESS, "k2");
    });

    it("a failed read is unreadable, not 'none'", async () => {
        const result = await loadRelations(deps({getDaosByAdmin: async () => { throw new Error("HTTP 500"); }}), me);
        expect(result.subDaos).toBeNull();
    });

    it("more pages than it reads is unreadable too: an incomplete list is never shown as the whole one", async () => {
        const result = await loadRelations(deps({getDaosByAdmin: async () => ({items: [dao()], nextKey: "more"})}), me);
        expect(result.subDaos).toBeNull();
    });

    it("a treasury that cannot be read is null for that sub-DAO only", async () => {
        const getBalances = vi.fn(async (): Promise<{denom: string; amount: string}[]> => { throw new Error("down"); });
        const result = await loadRelations(deps({getDaosByAdmin: async () => ({items: [dao()], nextKey: null}), getBalances}), me);
        expect(result.subDaos).toEqual([{dao: dao(), treasury: null}]);
    });
});

describe("the nominations", () => {
    it("takes only the DAOs whose own pending admin is this DAO: Scan finds candidates, the chain decides", async () => {
        const mine = dao({id: "9", address: OTHER, pending_admin: DAO_ADDRESS, name: "Hive"});
        const stranger = dao({id: "10", address: THIRD, pending_admin: "bze1someoneelse"});
        const getDao = vi.fn(async (id: string) => ({"9": mine, "10": stranger})[id] ?? null);
        const result = await loadRelations(deps({getDao}, {daosNominating: async () => [{id: "9"}, {id: "10"}, {id: "11"}]}), me);
        expect(result.incoming).toEqual([{id: "9", name: "Hive", address: OTHER}]);
    });

    it("is unknown (null) when Scan does not answer, and when the chain cannot confirm a candidate", async () => {
        const down = await loadRelations(deps({}, {daosNominating: async () => { throw new ScanUnavailableError("down"); }}), me);
        expect(down.incoming).toBeNull();
        const broken = await loadRelations(deps({getDao: async () => { throw new Error("HTTP 500"); }}, {daosNominating: async () => [{id: "9"}]}), me);
        expect(broken.incoming).toBeNull();
    });
});

describe("the staking sources", () => {
    it("are read for a stake DAO", async () => {
        const getStakeOptions = vi.fn(async () => [{kind: "sr" as const, id: "1", stakingDenom: "ulmn", lock: 7, staked: "5", own: "0"}]);
        const result = await loadRelations(deps({getStakeOptions}), {address: DAO_ADDRESS, type: "DAO_TYPE_STAKE"});
        expect(result.sources).toHaveLength(1);
        expect(getStakeOptions).toHaveBeenCalledWith(DAO_ADDRESS);
    });

    it("are read for a member-list DAO only when it administers a stake DAO", async () => {
        const getStakeOptions = vi.fn(async () => []);
        await loadRelations(deps({getStakeOptions}), me);
        expect(getStakeOptions).not.toHaveBeenCalled();
        const stakeSub = dao({type: "DAO_TYPE_STAKE", members: []});
        await loadRelations(deps({getStakeOptions, getDaosByAdmin: async () => ({items: [stakeSub], nextKey: null})}), me);
        expect(getStakeOptions).toHaveBeenCalledTimes(1);
    });

    it("a failed read is unreadable (null)", async () => {
        const result = await loadRelations(deps({getStakeOptions: async () => { throw new Error("x"); }}), {address: DAO_ADDRESS, type: "DAO_TYPE_STAKE"});
        expect(result.sources).toBeNull();
    });
});

describe("the Scan reader", () => {
    it("asks for the DAOs nominating an address, through the app's proxy", async () => {
        const get = vi.fn(async () => ({status: 200, body: {items: [{id: 9, name: "Hive"}, {id: "10"}, {nope: true}], next_cursor: null}}));
        await expect(createRelationScan(get).daosNominating(DAO_ADDRESS)).resolves.toEqual([{id: "9"}, {id: "10"}]);
        expect(get).toHaveBeenCalledWith("daos", [["pending_admin", DAO_ADDRESS], ["limit", "20"]]);
    });

    it.each([
        ["an error status", async () => ({status: 502, body: null})],
        ["a body without items", async () => ({status: 200, body: {}})],
        ["a request that throws", async () => { throw new Error("offline"); }],
    ])("is unavailable for %s", async (_name, get) => {
        await expect(createRelationScan(get as never).daosNominating(DAO_ADDRESS)).rejects.toBeInstanceOf(ScanUnavailableError);
    });
});
