import {describe, expect, it, vi} from "vitest";
import {act, renderHook, waitFor} from "@testing-library/react";
import type {PagedPage, PagePosition} from "@/lib/paged-list";
import {usePagedList} from "./usePagedList";

type Page = PagedPage<string, "scan"> & {counts: number};

const page = (items: string[], over: Partial<Page> = {}): Page =>
    ({state: "ok", items, returned: items.length, source: "scan", mode: "pages", total: 40, next: null, counts: 7, ...over});

describe("usePagedList", () => {
    it("keeps the last answer of any scope as `latest`, with the loader's own fields", async () => {
        let answer: (p: Page) => void = () => {};
        let calls = 0;
        const load = vi.fn((): Promise<Page> => (++calls === 1
            ? Promise.resolve(page(["a"], {counts: 18}))
            : new Promise<Page>((resolve) => { answer = resolve; })));
        const {result, rerender} = renderHook(({scope}) => usePagedList<Page>(scope, 1, 20, load), {initialProps: {scope: "all"}});

        await waitFor(() => expect(result.current.items).toEqual(["a"]));
        expect(result.current.pages).toBe(2);

        rerender({scope: "active"});
        // the new scope is loading: no rows and no pager of its own yet, but the counts of the last answer stay
        expect(result.current.loading).toBe(true);
        expect(result.current.mode).toBeNull();
        expect(result.current.latest?.counts).toBe(18);

        await act(async () => answer(page(["b"], {counts: 19})));
        expect(result.current.latest?.counts).toBe(19);
        expect(result.current.items).toEqual(["b"]);
    });

    it("never shows the latest answer of another group (another DAO's counts)", async () => {
        let calls = 0;
        const load = vi.fn((): Promise<Page> => (++calls === 1 ? Promise.resolve(page(["a"], {counts: 18})) : new Promise<Page>(() => {})));
        const {result, rerender} = renderHook(({dao}) => usePagedList<Page>(`${dao}|all`, 1, 20, load, dao), {initialProps: {dao: "4"}});
        await waitFor(() => expect(result.current.latest?.counts).toBe(18));

        rerender({dao: "5"});
        expect(result.current.loading).toBe(true);
        expect(result.current.latest).toBeNull();
    });

    it("walks a cursor trail and passes the source back", async () => {
        const load = vi.fn(async (position: PagePosition<"scan">) =>
            page([position.cursor ?? "first"], {mode: "cursor", total: null, next: position.cursor ? null : "c1"}));
        const {result} = renderHook(() => usePagedList<Page>("all", 1, 20, load));

        await waitFor(() => expect(result.current.hasNext).toBe(true));
        expect(result.current.page).toBe(1);
        act(() => result.current.goNext());
        await waitFor(() => expect(result.current.items).toEqual(["c1"]));
        expect(result.current.page).toBe(2);
        expect(result.current.hasPrev).toBe(true);
        expect(load).toHaveBeenLastCalledWith({page: 1, cursor: "c1", source: "scan"});
    });

    it("passes another state of the loader through as `result`", async () => {
        const {result} = renderHook(() => usePagedList<Page, {state: "needs-scan"}>("all", 1, 20, async () => ({state: "needs-scan"})));
        await waitFor(() => expect(result.current.result).toEqual({state: "needs-scan"}));
        expect(result.current.items).toEqual([]);
        expect(result.current.current).toBeNull();
    });
});
