import {describe, expect, it, vi} from "vitest";
import type {Dao} from "@bze/bze-ui-kit";
import {loadDaoPage, loadMyDaos, type DaoChain, type DaoDeps} from "./dao-loader";
import type {DaoScanClient} from "./dao-scan";
import type {ScanDao, ScanDaoList} from "./dao-types";

const ME = "bze1me";

const scanDao = (id: number, over: Partial<ScanDao> = {}): ScanDao => ({
    id, name: `Dao ${id}`, type: "static_list", address: `bze1dao${id}`, admin: "bze1other", self_governed: false,
    created_time: "2026-11-01T10:00:00Z", proposals_open: 0, ...over,
});

const chainDao = (id: number, over: Partial<Dao> = {}): Dao => ({
    id: String(id), address: `bze1dao${id}`, admin: "bze1other", pending_admin: "", type: "DAO_TYPE_STATIC_LIST", name: `Dao ${id}`,
    description: "", config: {} as Dao["config"], members: [], created_at: "1790000000", admin_seq: "0", pending_admin_seq: "0", ...over,
});

const list = (items: ScanDao[], over: Partial<ScanDaoList> = {}): ScanDaoList => ({items, next_cursor: null, supported: true, total: null, ...over});

function deps(scan: Partial<DaoScanClient> = {}, chain: Partial<DaoChain> = {}): DaoDeps & {scan: DaoScanClient; chain: DaoChain} {
    return {
        scan: {
            listDaos: vi.fn(async () => list([])),
            filtersSupported: vi.fn(async () => 'yes' as const),
            ...scan,
        },
        chain: {
            isSupported: vi.fn(async () => true),
            getDaos: vi.fn(async () => ({items: [], nextKey: null})),
            getDaosByAdmin: vi.fn(async () => ({items: [], nextKey: null})),
            getDao: vi.fn(async () => null),
            stakingRewardParticipations: vi.fn(async () => []),
            denomRewardParticipations: vi.fn(async () => []),
            ...chain,
        },
    };
}

const FILTER = {kind: "" as const, search: ""};
const FIRST = {page: 1};

describe("loadDaoPage", () => {
    it("an unsupported answer (no total) does not put the client on cursor paging", async () => {
        const listDaos = vi.fn<DaoScanClient["listDaos"]>()
            .mockResolvedValueOnce({items: [], next_cursor: null, supported: false, total: null})
            .mockResolvedValue(list([scanDao(1)], {total: 1}));
        const d = deps({listDaos});
        expect(await loadDaoPage(d, FILTER, FIRST)).toEqual({state: "unsupported"});
        expect(await loadDaoPage(d, FILTER, FIRST)).toMatchObject({state: "ok", mode: "pages", total: 1});
        expect(listDaos).toHaveBeenLastCalledWith({page: 1, limit: 20});
    });

    it("reads Scan's numbered page with the type filter and the search, and returns the total", async () => {
        const d = deps({listDaos: vi.fn(async () => list([scanDao(2, {proposals_open: 3})], {total: 24, next_cursor: "c2"}))});
        const result = await loadDaoPage(d, {kind: "stake", search: "club"}, {page: 2});

        expect(d.scan.listDaos).toHaveBeenCalledWith({type: "stake", q: "club", page: 2, limit: 20});
        expect(result).toMatchObject({state: "ok", source: "scan", mode: "pages", total: 24});
        expect(result.state === "ok" && result.items[0]).toMatchObject({id: "2", proposalsOpen: 3});
    });

    it("does not send a search shorter than two characters", async () => {
        const d = deps();
        await loadDaoPage(d, {kind: "", search: " a "}, FIRST);
        expect(d.scan.listDaos).toHaveBeenCalledWith(expect.objectContaining({q: undefined}));
    });

    it("filters the name on the page itself when Scan ignores the search (before BFE-368)", async () => {
        const d = deps({
            filtersSupported: vi.fn(async () => 'no' as const),
            listDaos: vi.fn(async () => list([scanDao(1, {name: "Founders"}), scanDao(2, {name: "Stakers club"})], {total: 2})),
        });
        const result = await loadDaoPage(d, {kind: "", search: "club"}, FIRST);

        expect(d.scan.listDaos).toHaveBeenCalledWith(expect.objectContaining({q: undefined}));
        expect(result.state === "ok" && result.items.map((c) => c.name)).toEqual(["Stakers club"]);
    });

    it("keeps a total of zero as a numbered, empty list", async () => {
        const d = deps({listDaos: vi.fn(async () => list([], {total: 0}))});
        expect(await loadDaoPage(d, FILTER, FIRST)).toMatchObject({state: "ok", mode: "pages", total: 0, items: []});
    });

    it("is the unsupported state when Scan says the node has no x/dao", async () => {
        const d = deps({listDaos: vi.fn(async () => list([], {supported: false}))});
        expect(await loadDaoPage(d, FILTER, FIRST)).toEqual({state: "unsupported"});
        expect(d.chain.getDaos).not.toHaveBeenCalled();
    });

    describe("a Scan without totals (before BFE-423)", () => {
        // such a Scan ignores `page` and answers the first cursor page
        const older = () => deps({
            listDaos: vi.fn(async (req) => (req.cursor === "c1" ? list([scanDao(1)]) : list([scanDao(3), scanDao(2)], {next_cursor: "c1"}))),
        });

        it("answers by cursor from the first answer on, whatever page the URL asked for", async () => {
            const d = older();
            const first = await loadDaoPage(d, FILTER, {page: 3});

            expect(first).toMatchObject({state: "ok", mode: "cursor", total: null, next: "c1"});
            expect(d.scan.listDaos).toHaveBeenCalledWith({page: 3, limit: 20});
        });

        it("then reads the later pages by cursor and never sends a page again", async () => {
            const d = older();
            await loadDaoPage(d, FILTER, FIRST);
            const second = await loadDaoPage(d, FILTER, {page: 1, cursor: "c1"});

            expect(d.scan.listDaos).toHaveBeenLastCalledWith({cursor: "c1", limit: 20});
            expect(second).toMatchObject({mode: "cursor", next: null});
            expect(second.state === "ok" && second.items.map((c) => c.id)).toEqual(["1"]);
        });

        it("remembers the verdict for the next list, too", async () => {
            const d = older();
            await loadDaoPage(d, FILTER, FIRST);
            await loadDaoPage(d, {kind: "stake", search: ""}, FIRST);
            expect(d.scan.listDaos).toHaveBeenLastCalledWith({type: "stake", cursor: null, limit: 20});
        });

        it("is decided per Scan client", async () => {
            await loadDaoPage(older(), FILTER, FIRST);
            const fresh = deps({listDaos: vi.fn(async () => list([], {total: 0}))});
            await loadDaoPage(fresh, FILTER, FIRST);
            expect(fresh.scan.listDaos).toHaveBeenCalledWith({page: 1, limit: 20});
        });
    });

    describe("Scan down", () => {
        const down = () => ({listDaos: vi.fn(async () => { throw new Error("down"); })});

        it("falls back to the chain's first page: unfiltered, by key, without open counts or a total", async () => {
            const d = deps(down(), {
                getDaos: vi.fn(async () => ({
                    items: [chainDao(1, {name: "Founders"}), chainDao(2, {name: "Stakers club", type: "DAO_TYPE_STAKE"})],
                    nextKey: "k2",
                })),
            });
            const result = await loadDaoPage(d, {kind: "stake", search: "club"}, FIRST);

            expect(result).toMatchObject({state: "ok", source: "chain", mode: "cursor", total: null, next: "k2"});
            expect(result.state === "ok" && result.items.map((c) => [c.id, c.proposalsOpen])).toEqual([["1", null], ["2", null]]);
        });

        it("is the unsupported state on a v8.2.x node", async () => {
            const d = deps(down(), {isSupported: vi.fn(async () => false)});
            expect(await loadDaoPage(d, FILTER, FIRST)).toEqual({state: "unsupported"});
        });

        it("throws when the chain cannot be reached either: an error, not 'unsupported'", async () => {
            const d = deps(down(), {isSupported: vi.fn(async () => { throw new Error("network"); })});
            await expect(loadDaoPage(d, FILTER, FIRST)).rejects.toThrow("network");
        });

        it("keeps reading the chain's pages once the list is on the chain", async () => {
            const d = deps(down());
            await loadDaoPage(d, FILTER, {page: 1, cursor: "k2", source: "chain"});
            expect(d.scan.listDaos).not.toHaveBeenCalled();
            expect(d.chain.getDaos).toHaveBeenCalledWith(expect.objectContaining({key: "k2"}));
        });

        it("a later numbered page throws instead of showing the chain's first page under ?page=2", async () => {
            const d = deps(down());
            await expect(loadDaoPage(d, FILTER, {page: 2})).rejects.toThrow("down");
            expect(d.chain.getDaos).not.toHaveBeenCalled();
        });

        it("does not swap sources in the middle of a Scan list", async () => {
            const d = deps(down());
            await expect(loadDaoPage(d, FILTER, {page: 1, cursor: "c2", source: "scan"})).rejects.toThrow("down");
            expect(d.chain.getDaos).not.toHaveBeenCalled();
        });
    });
});

describe("loadMyDaos", () => {
    it("lists a DAO with every reason that applies, once", async () => {
        const d = deps({
            listDaos: vi.fn(async (req) => (req.member ? list([scanDao(5), scanDao(6)]) : list([scanDao(6)]))),
        }, {
            getDaosByAdmin: vi.fn(async () => ({items: [chainDao(6), chainDao(9)], nextKey: null})),
            denomRewardParticipations: vi.fn(async () => [{address: ME, staking_denom: "ubze", amount: "10"}]),
        });
        const {rows, onlyAdmin, adminFailed} = await loadMyDaos(d, ME);

        expect(rows.map((r) => [r.dao.id, r.reasons])).toEqual([["9", ["Admin"]], ["6", ["Admin", "Member", "Staker"]], ["5", ["Member"]]]);
        expect(d.scan.listDaos).toHaveBeenCalledWith(expect.objectContaining({sources: ["dr/ubze"]}));
        expect(onlyAdmin).toBe(false);
        expect(adminFailed).toBe(false);
    });

    describe("the DAOs that nominated the wallet", () => {
        const nominating = (id: number) => chainDao(id, {pending_admin: ME});
        const asks = (d: ReturnType<typeof deps>) => vi.mocked(d.scan.listDaos).mock.calls.map(([r]) => r).filter((r) => r.pendingAdmin);

        it("lists them as Nominated, each one confirmed by the chain's own pending admin", async () => {
            const d = deps({
                listDaos: vi.fn(async (req) => (req.pendingAdmin ? list([scanDao(5), scanDao(6)]) : list([]))),
            }, {
                getDao: vi.fn(async (id: string) => (id === "5" ? nominating(5) : chainDao(6, {pending_admin: "bze1someoneelse"}))),
            });
            const result = await loadMyDaos(d, ME);

            // Scan named two; only the one whose pending admin is this wallet is listed
            expect(result.rows.map((r) => [r.dao.id, r.reasons])).toEqual([["5", ["Nominated"]]]);
            expect(asks(d)).toEqual([expect.objectContaining({pendingAdmin: ME})]);
            expect(result.nominatedFailed).toBe(false);
        });

        it("reads every page of the answer", async () => {
            const listDaos = vi.fn(async (req: {pendingAdmin?: string; cursor?: string | null}) => {
                if (!req.pendingAdmin) return list([]);
                return req.cursor ? list([scanDao(6)]) : list([scanDao(5)], {next_cursor: "c2"});
            });
            const d = deps({listDaos}, {getDao: vi.fn(async (id: string) => nominating(Number(id)))});
            expect((await loadMyDaos(d, ME)).rows.map((r) => r.dao.id)).toEqual(["6", "5"]);
        });

        it("a list that never ends is a failed read, not a short list", async () => {
            const d = deps({listDaos: vi.fn(async (req) => (req.pendingAdmin ? list([scanDao(5)], {next_cursor: "more"}) : list([])))}, {getDao: vi.fn(async () => nominating(5))});
            const result = await loadMyDaos(d, ME);
            expect(result.nominatedFailed).toBe(true);
            expect(result.rows).toEqual([]);
        });

        it("a chain read that fails is a failed read, and a DAO the chain does not have is no nomination", async () => {
            const scan = {listDaos: vi.fn(async (req: {pendingAdmin?: string}) => (req.pendingAdmin ? list([scanDao(5)]) : list([])))};
            const down = await loadMyDaos(deps(scan, {getDao: vi.fn(async () => { throw new Error("rest"); })}), ME);
            expect(down.nominatedFailed).toBe(true);
            const gone = await loadMyDaos(deps(scan, {getDao: vi.fn(async () => null)}), ME);
            expect(gone).toMatchObject({nominatedFailed: false, rows: []});
        });

        it("asks nothing from a Scan without the filters (it would answer every DAO), and flags an unknown probe", async () => {
            const no = deps({filtersSupported: vi.fn(async () => 'no' as const)});
            expect((await loadMyDaos(no, ME)).nominatedFailed).toBe(false);
            expect(asks(no)).toEqual([]);
            const unknown = deps({filtersSupported: vi.fn(async () => 'unknown' as const)});
            expect((await loadMyDaos(unknown, ME)).nominatedFailed).toBe(true);
        });
    });

    it("leaves the self-owned DAOs out of the admin list", async () => {
        const d = deps({}, {getDaosByAdmin: vi.fn(async () => ({items: [chainDao(3, {admin: "bze1dao3"}), chainDao(4)], nextKey: null}))});
        expect((await loadMyDaos(d, ME)).rows.map((r) => r.dao.id)).toEqual(["4"]);
    });

    it("shows the administered DAOs only, and never asks Scan for filters, while Scan lacks BFE-368", async () => {
        const d = deps({filtersSupported: vi.fn(async () => 'no' as const)}, {getDaosByAdmin: vi.fn(async () => ({items: [chainDao(4)], nextKey: null}))});
        const result = await loadMyDaos(d, ME);

        expect(result.onlyAdmin).toBe(true);
        expect(result.rows.map((r) => r.dao.id)).toEqual(["4"]);
        expect(d.scan.listDaos).not.toHaveBeenCalled();
        expect(d.chain.stakingRewardParticipations).not.toHaveBeenCalled();
    });

    it("keeps the administered DAOs when Scan is down", async () => {
        const d = deps({listDaos: vi.fn(async () => { throw new Error("down"); })}, {getDaosByAdmin: vi.fn(async () => ({items: [chainDao(4)], nextKey: null}))});
        const result = await loadMyDaos(d, ME);
        expect(result.rows.map((r) => r.dao.id)).toEqual(["4"]);
        expect(result.onlyAdmin).toBe(false);
        expect(result.memberFailed).toBe(true);
    });

    it("still lists the joined DAOs when the x/rewards read fails, and says the staked ones are missing", async () => {
        const d = deps({listDaos: vi.fn(async (req) => (req.member ? list([scanDao(5)]) : list([])))}, {
            denomRewardParticipations: vi.fn(async () => { throw new Error("rewards"); }),
        });
        const result = await loadMyDaos(d, ME);

        expect(result.rows.map((r) => [r.dao.id, r.reasons])).toEqual([["5", ["Member"]]]);
        expect(result.stakerFailed).toBe(true);
        expect(result.memberFailed).toBe(false);
        expect(result.onlyAdmin).toBe(false);
    });

    it("reports an unreachable Scan probe as failed reads, not as a Scan without the filters", async () => {
        const d = deps({filtersSupported: vi.fn(async () => 'unknown' as const)});
        const result = await loadMyDaos(d, ME);

        expect(result).toMatchObject({onlyAdmin: false, memberFailed: true, stakerFailed: true});
        expect(d.scan.listDaos).not.toHaveBeenCalled();
    });

    it("flags a failed admin read and still lists the rest", async () => {
        const d = deps({listDaos: vi.fn(async (req) => (req.member ? list([scanDao(5)]) : list([])))}, {getDaosByAdmin: vi.fn(async () => { throw new Error("rest"); })});
        const result = await loadMyDaos(d, ME);
        expect(result.adminFailed).toBe(true);
        expect(result.rows.map((r) => r.dao.id)).toEqual(["5"]);
    });

    it("asks Scan for the sources of both x/rewards answers, 20 at a time", async () => {
        const sr = Array.from({length: 25}, (_, i) => ({reward_id: String(i + 1), amount: "1"}));
        const d = deps({}, {
            stakingRewardParticipations: vi.fn(async () => sr),
            denomRewardParticipations: vi.fn(async () => [{address: ME, staking_denom: "ubze", amount: "1"}]),
        });
        await loadMyDaos(d, ME);
        const sourceCalls = vi.mocked(d.scan.listDaos).mock.calls.map(([r]) => r.sources).filter(Boolean);

        expect(sourceCalls.map((s) => s!.length)).toEqual([20, 6]);
        expect(sourceCalls[1]).toContain("dr/ubze");
        expect(sourceCalls[0]![0]).toBe("sr/1");
    });

    it("sends no source request for a wallet that stakes nowhere", async () => {
        const d = deps();
        await loadMyDaos(d, ME);
        expect(vi.mocked(d.scan.listDaos).mock.calls.filter(([r]) => r.sources)).toEqual([]);
    });
});
