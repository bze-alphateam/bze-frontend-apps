import {describe, expect, it, vi} from "vitest";
import {act, renderHook, waitFor} from "@testing-library/react";
import type {Dao} from "@bze/bze-ui-kit";
import type {DaoChain, DaoDeps} from "@/lib/dao-loader";
import type {DaoListRequest, DaoScanClient} from "@/lib/dao-scan";
import type {ScanDao, ScanDaoList} from "@/lib/dao-types";
import {useDaoList} from "./useDaoList";

const scanDao = (id: number, name = `Dao ${id}`): ScanDao => ({
    id, name, type: "static_list", address: `bze1dao${id}`, admin: "bze1other", self_governed: false,
    created_time: "2026-11-01T10:00:00Z", proposals_open: 0,
});

const chainDao = (id: number): Dao => ({
    id: String(id), address: `bze1dao${id}`, admin: "bze1other", pending_admin: "", type: "DAO_TYPE_STATIC_LIST", name: `Dao ${id}`,
    description: "", config: {} as Dao["config"], members: [], created_at: "1790000000", admin_seq: "0", pending_admin_seq: "0",
});

const list = (items: ScanDao[], over: Partial<ScanDaoList> = {}): ScanDaoList => ({items, next_cursor: null, supported: true, total: items.length, ...over});

const deps = (listDaos: DaoScanClient["listDaos"], chain: Partial<DaoChain> = {}, filters: "yes" | "no" = "yes"): DaoDeps => ({
    scan: {listDaos, filtersSupported: vi.fn(async () => filters)},
    chain: {
        isSupported: vi.fn(async () => true),
        getDaos: vi.fn(async () => ({items: [], nextKey: null})),
        getDaosByAdmin: vi.fn(async () => ({items: [], nextKey: null})),
        getDao: vi.fn(async () => null),
        stakingRewardParticipations: vi.fn(async () => []),
        denomRewardParticipations: vi.fn(async () => []),
        ...chain,
    },
});

const NONE = {kind: "" as const, search: ""};

describe("useDaoList", () => {
    it("does not let the answer of an older page overwrite what the pager remembers", async () => {
        const pending = new Map<number, (answer: ScanDaoList) => void>();
        const d = deps((request: DaoListRequest) => new Promise<ScanDaoList>((resolve) => pending.set(request.page ?? 0, resolve)));
        const {result, rerender} = renderHook(({page}) => useDaoList(d, NONE, page), {initialProps: {page: 1}});

        await waitFor(() => expect(pending.has(1)).toBe(true));
        rerender({page: 2});
        await waitFor(() => expect(pending.has(2)).toBe(true));

        // page 1 answers late, from a Scan that gives no total, while page 2 is still loading
        await act(async () => pending.get(1)!(list([scanDao(1)], {total: null, next_cursor: "c1"})));
        expect(result.current.loading).toBe(true);
        expect(result.current.mode).toBeNull();
        expect(result.current.total).toBeNull();

        await act(async () => pending.get(2)!(list([scanDao(2)], {total: 40})));
        expect(result.current.mode).toBe("pages");
        expect(result.current.total).toBe(40);
    });

    it("stays on the chain when Prev goes back to the first page", async () => {
        const getDaos = vi.fn(async ({key}: {key?: string}) => (key ? {items: [chainDao(1)], nextKey: null} : {items: [chainDao(2)], nextKey: "k2"}));
        const listDaos = vi.fn<DaoScanClient["listDaos"]>(async () => { throw new Error("down"); });
        const d = deps(listDaos, {getDaos: getDaos as DaoChain["getDaos"]});
        const {result} = renderHook(() => useDaoList(d, NONE, 1));

        await waitFor(() => expect(result.current.items.map((c) => c.id)).toEqual(["2"]));
        expect(result.current.source).toBe("chain");
        expect(listDaos).toHaveBeenCalledTimes(1);

        act(() => result.current.goNext());
        await waitFor(() => expect(result.current.items.map((c) => c.id)).toEqual(["1"]));
        act(() => result.current.goPrev());
        await waitFor(() => expect(result.current.items.map((c) => c.id)).toEqual(["2"]));

        expect(listDaos).toHaveBeenCalledTimes(1);
        expect(result.current.source).toBe("chain");
    });

    it("asks Scan again after a retry", async () => {
        const listDaos = vi.fn<DaoScanClient["listDaos"]>(async () => { throw new Error("down"); });
        const d = deps(listDaos, {getDaos: vi.fn(async () => ({items: [chainDao(2)], nextKey: null}))});
        const {result} = renderHook(() => useDaoList(d, NONE, 1));
        await waitFor(() => expect(result.current.source).toBe("chain"));

        listDaos.mockImplementation(async () => list([scanDao(9)]));
        act(() => result.current.retry());
        await waitFor(() => expect(result.current.source).toBe("scan"));
    });

    it("is not past the end when the rows only vanished in the search that runs on the page", async () => {
        // a Scan without the BFE-368 filters ignores `q`: the page is real, but none of its rows match
        const d = deps(async () => list([scanDao(1, "Founders"), scanDao(2, "Beekeepers")], {total: 23}), {}, "no");
        const {result} = renderHook(() => useDaoList(d, {kind: "", search: "zzz"}, 2));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.items).toEqual([]);
        expect(result.current.pastEnd).toBeNull();
    });

    it("is past the end when Scan returned no rows for a page of a list that has some", async () => {
        const d = deps(async () => list([], {total: 23}));
        const {result} = renderHook(() => useDaoList(d, NONE, 9));

        await waitFor(() => expect(result.current.pastEnd).toBe(2));
    });
});
