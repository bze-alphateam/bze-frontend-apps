import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { Dao } from "@bze/bze-ui-kit";
import type { DaoAdminServices } from "@/lib/dao-admin";
import { useDaoAdmin, useDaoAdmins } from "./useDaoAdmin";

const DAO_ADDRESS = "bze1sx6ep2vtlzsdj73tseeq3ydahqyt0ey2gs3tg0";
const PLAIN = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";
const DAO = { id: "7", name: "Honey Guild", type: "DAO_TYPE_STATIC_LIST" } as unknown as Dao;

const make = (over: Partial<DaoAdminServices> = {}): DaoAdminServices => ({
    isSupported: vi.fn(async () => true),
    byAddress: vi.fn(async (a: string) => (a === DAO_ADDRESS ? DAO : null)),
    controller: vi.fn(async () => null),
    ...over,
});

beforeEach(() => localStorage.clear());

describe("useDaoAdmin", () => {
    it("a DAO's address gives the DAO", async () => {
        const { result } = renderHook(() => useDaoAdmin(DAO_ADDRESS, make()));
        expect(result.current.isLoading).toBe(true);
        await waitFor(() => expect(result.current.dao).toEqual(DAO));
        expect(result.current.lookup?.status).toBe("dao");
        expect(result.current.isLoading).toBe(false);
    });

    it("a plain address (404 → null) gives none", async () => {
        const { result } = renderHook(() => useDaoAdmin(PLAIN, make()));
        await waitFor(() => expect(result.current.lookup?.status).toBe("none"));
        expect(result.current.dao).toBeUndefined();
    });

    it("a 501 node gives unsupported", async () => {
        const { result } = renderHook(() => useDaoAdmin(PLAIN, make({ isSupported: async () => false })));
        await waitFor(() => expect(result.current.lookup?.status).toBe("unsupported"));
        expect(result.current.dao).toBeUndefined();
    });

    it("a network error gives failed, never a throw", async () => {
        const { result } = renderHook(() => useDaoAdmin(PLAIN, make({ byAddress: async () => { throw new Error("network"); } })));
        await waitFor(() => expect(result.current.lookup?.status).toBe("failed"));
        expect(result.current.dao).toBeUndefined();
    });

    it("no address (renounced, still loading) makes no query", () => {
        const services = make();
        const { result } = renderHook(() => useDaoAdmin(undefined, services));
        expect(result.current.isLoading).toBe(false);
        expect(services.isSupported).not.toHaveBeenCalled();
    });
});

describe("useDaoAdmins", () => {
    it("looks each distinct address up once", async () => {
        const services = make();
        const { result } = renderHook(() => useDaoAdmins([DAO_ADDRESS, PLAIN, DAO_ADDRESS, undefined, ""], services));
        await waitFor(() => expect(Object.keys(result.current.lookups).sort()).toEqual([DAO_ADDRESS, PLAIN].sort()));
        expect(services.byAddress).toHaveBeenCalledTimes(2);
    });
});
