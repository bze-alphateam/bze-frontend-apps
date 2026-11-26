import {describe, expect, it, vi} from "vitest";
import type {Dao} from "@bze/bze-ui-kit";
import {loadDaoPage, loadMyDaos, loadOpenProposals, type DaoChain, type DaoDeps} from "./dao-loader";
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

const list = (items: ScanDao[], over: Partial<ScanDaoList> = {}): ScanDaoList => ({items, next_cursor: null, supported: true, ...over});

function deps(scan: Partial<DaoScanClient> = {}, chain: Partial<DaoChain> = {}): DaoDeps & {scan: DaoScanClient; chain: DaoChain} {
    return {
        scan: {
            listDaos: vi.fn(async () => list([])),
            openProposals: vi.fn(async () => ({items: [], next_cursor: null, supported: true})),
            filtersSupported: vi.fn(async () => 'yes' as const),
            ...scan,
        },
        chain: {
            isSupported: vi.fn(async () => true),
            getDaos: vi.fn(async () => ({items: [], nextKey: null})),
            getDaosByAdmin: vi.fn(async () => ({items: [], nextKey: null})),
            stakingRewardParticipations: vi.fn(async () => []),
            denomRewardParticipations: vi.fn(async () => []),
            ...chain,
        },
    };
}

const FILTER = {kind: "" as const, search: ""};

describe("loadDaoPage", () => {
    it("reads Scan's page and sends the type filter and the search", async () => {
        const d = deps({listDaos: vi.fn(async () => list([scanDao(2, {proposals_open: 3})], {next_cursor: "c2"}))});
        const result = await loadDaoPage(d, {kind: "stake", search: "club"}, null);

        expect(d.scan.listDaos).toHaveBeenCalledWith({type: "stake", q: "club", cursor: null, limit: 20});
        expect(result).toMatchObject({state: "ok", source: "scan", next: "c2"});
        expect(result.state === "ok" && result.items[0]).toMatchObject({id: "2", proposalsOpen: 3});
    });

    it("does not send a search shorter than two characters", async () => {
        const d = deps();
        await loadDaoPage(d, {kind: "", search: " a "}, null);
        expect(d.scan.listDaos).toHaveBeenCalledWith(expect.objectContaining({q: undefined}));
    });

    it("filters the name on the page itself when Scan ignores the search (before BFE-368)", async () => {
        const d = deps({
            filtersSupported: vi.fn(async () => 'no' as const),
            listDaos: vi.fn(async () => list([scanDao(1, {name: "Founders"}), scanDao(2, {name: "Stakers club"})])),
        });
        const result = await loadDaoPage(d, {kind: "", search: "club"}, null);

        expect(d.scan.listDaos).toHaveBeenCalledWith(expect.objectContaining({q: undefined}));
        expect(result.state === "ok" && result.items.map((c) => c.name)).toEqual(["Stakers club"]);
    });

    it("is the unsupported state when Scan says the node has no x/dao", async () => {
        const d = deps({listDaos: vi.fn(async () => list([], {supported: false}))});
        expect(await loadDaoPage(d, FILTER, null)).toEqual({state: "unsupported"});
        expect(d.chain.getDaos).not.toHaveBeenCalled();
    });

    describe("Scan down", () => {
        const down = () => ({listDaos: vi.fn(async () => { throw new Error("down"); })});

        it("falls back to the chain's list, filtered here, without open counts", async () => {
            const d = deps(down(), {
                getDaos: vi.fn(async () => ({
                    items: [chainDao(1, {name: "Founders"}), chainDao(2, {name: "Stakers club", type: "DAO_TYPE_STAKE"})],
                    nextKey: "k2",
                })),
            });
            const result = await loadDaoPage(d, {kind: "stake", search: ""}, null);

            expect(result).toMatchObject({state: "ok", source: "chain", next: "k2"});
            expect(result.state === "ok" && result.items).toEqual([expect.objectContaining({id: "2", kind: "stake", proposalsOpen: null})]);
        });

        it("is the unsupported state on a v8.2.x node", async () => {
            const d = deps(down(), {isSupported: vi.fn(async () => false)});
            expect(await loadDaoPage(d, FILTER, null)).toEqual({state: "unsupported"});
        });

        it("throws when the chain cannot be reached either: an error, not 'unsupported'", async () => {
            const d = deps(down(), {isSupported: vi.fn(async () => { throw new Error("network"); })});
            await expect(loadDaoPage(d, FILTER, null)).rejects.toThrow("network");
        });

        it("keeps reading the chain's pages once the list is on the chain", async () => {
            const d = deps(down());
            await loadDaoPage(d, FILTER, "k2", "chain");
            expect(d.scan.listDaos).not.toHaveBeenCalled();
            expect(d.chain.getDaos).toHaveBeenCalledWith(expect.objectContaining({key: "k2"}));
        });

        it("does not swap sources in the middle of a Scan list", async () => {
            const d = deps(down());
            await expect(loadDaoPage(d, FILTER, "c2", "scan")).rejects.toThrow("down");
            expect(d.chain.getDaos).not.toHaveBeenCalled();
        });
    });
});

describe("loadOpenProposals", () => {
    const proposal = {id: 4, dao_id: 1, title: "Fund", status: "voting", voting_end: "2026-12-01T00:00:00Z", dao: {id: 1, name: "Dao 1", type: "stake"}};

    it("lists the open proposals", async () => {
        const d = deps({openProposals: vi.fn(async () => ({items: [proposal], next_cursor: null, supported: true}))});
        expect(await loadOpenProposals(d)).toEqual([proposal]);
        expect(d.scan.openProposals).toHaveBeenCalledWith(null, 10);
    });

    it("is empty without the BFE-368 route, when the node is not supported, and when Scan is down", async () => {
        expect(await loadOpenProposals(deps({filtersSupported: vi.fn(async () => 'no' as const)}))).toEqual([]);
        expect(await loadOpenProposals(deps({openProposals: vi.fn(async () => ({items: [proposal], next_cursor: null, supported: false}))}))).toEqual([]);
        expect(await loadOpenProposals(deps({openProposals: vi.fn(async () => { throw new Error("down"); })}))).toEqual([]);
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
