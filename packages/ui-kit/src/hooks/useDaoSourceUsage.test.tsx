// @vitest-environment jsdom
import {describe, expect, it, vi} from "vitest";
import {renderHook, waitFor} from "@testing-library/react";
import {EMPTY_DAO_SOURCE_USAGE, type DaoSourceUsage, type DaoSourceUsageReader} from "../query/dao_source_usage";
import {useDaoSourceUsage} from "./useDaoSourceUsage";

const USAGE: DaoSourceUsage = {daos: [{id: "3", name: "Club"}], openProposals: [{id: "10", title: "P", daoId: "3", votingEnd: null}]};

describe("useDaoSourceUsage", () => {
    it("is loading, then returns the DAOs and open proposals of the source", async () => {
        const reader: DaoSourceUsageReader = {read: vi.fn().mockResolvedValue(USAGE)};
        const {result} = renderHook(() => useDaoSourceUsage("sr/1", reader));

        expect(result.current).toEqual({...EMPTY_DAO_SOURCE_USAGE, loading: true});
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.daos).toEqual(USAGE.daos);
        expect(result.current.openProposals).toEqual(USAGE.openProposals);
        expect(reader.read).toHaveBeenCalledWith("sr/1");
    });

    it("does nothing without a source", () => {
        const reader: DaoSourceUsageReader = {read: vi.fn()};
        const {result} = renderHook(() => useDaoSourceUsage(undefined, reader));

        expect(result.current).toEqual({...EMPTY_DAO_SOURCE_USAGE, loading: false});
        expect(reader.read).not.toHaveBeenCalled();
    });

    it("is empty when the reader rejects", async () => {
        const reader: DaoSourceUsageReader = {read: vi.fn().mockRejectedValue(new Error("down"))};
        const {result} = renderHook(() => useDaoSourceUsage("sr/1", reader));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.daos).toEqual([]);
    });

    it("drops the previous source's answer while the next one loads", async () => {
        const reader: DaoSourceUsageReader = {read: vi.fn(async (s: string) => (s === "sr/1" ? USAGE : EMPTY_DAO_SOURCE_USAGE))};
        const {result, rerender} = renderHook(({source}) => useDaoSourceUsage(source, reader), {initialProps: {source: "sr/1"}});
        await waitFor(() => expect(result.current.daos).toHaveLength(1));

        rerender({source: "sr/2"});
        expect(result.current.daos).toEqual([]);
        expect(result.current.loading).toBe(true);
        await waitFor(() => expect(result.current.loading).toBe(false));
    });
});
