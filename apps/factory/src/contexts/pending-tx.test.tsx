import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { PENDING_TX_TTL_MS, PendingTxProvider, PendingTxStorage, createPendingTxStore, usePendingTx } from "./pending-tx";

function memoryStorage(initial: string | null = null): PendingTxStorage & { value: () => string | null } {
    let value = initial;
    return { read: () => value, write: (v) => { value = v; }, value: () => value };
}

const ENTRY = { href: "/token/new?return=%2Fx", hash: "H1", title: "Create token HONEY", startedAt: 1_000, doneInput: { ticker: "HONEY" } };

describe("createPendingTxStore", () => {
    it("stores an entry as pending and writes it to the storage", () => {
        const storage = memoryStorage();
        const store = createPendingTxStore(storage, () => 2_000);
        store.add(ENTRY);

        expect(store.getSnapshot()).toEqual([{ ...ENTRY, status: "pending" }]);
        expect(JSON.parse(storage.value() ?? "[]")).toEqual([{ ...ENTRY, status: "pending" }]);
    });

    it("restores the entries of an earlier page load", () => {
        const first = createPendingTxStore(memoryStorage(), () => 2_000);
        first.add(ENTRY);
        first.resolve("H1", { status: "confirmed", height: 42 });

        const again = createPendingTxStore(memoryStorage(JSON.stringify(first.getSnapshot())), () => 3_000);
        expect(again.getSnapshot()).toEqual([{ ...ENTRY, status: "confirmed", height: 42 }]);
    });

    it("keeps one entry per wizard page and removes it by hash", () => {
        const store = createPendingTxStore(memoryStorage(), () => 2_000);
        store.add(ENTRY);
        store.add({ ...ENTRY, hash: "H2" });
        expect(store.getSnapshot().map(e => e.hash)).toEqual(["H2"]);

        store.remove("H2");
        expect(store.getSnapshot()).toEqual([]);
    });

    it("drops entries older than 30 minutes, on load and while open", () => {
        let now = ENTRY.startedAt + PENDING_TX_TTL_MS - 1;
        const old = JSON.stringify([{ ...ENTRY, status: "pending" }, { ...ENTRY, hash: "OLD", href: "/pool/new", startedAt: 0, status: "pending" }]);
        const storage = memoryStorage(old);
        const store = createPendingTxStore(storage, () => now);
        expect(store.getSnapshot().map(e => e.hash)).toEqual(["H1"]);

        now = ENTRY.startedAt + PENDING_TX_TTL_MS;
        expect(store.getSnapshot()).toEqual([]);
        expect(storage.value()).toBe("[]");
    });

    it("ignores unreadable storage", () => {
        expect(createPendingTxStore(memoryStorage("{not json"), () => 0).getSnapshot()).toEqual([]);
        expect(createPendingTxStore(memoryStorage(JSON.stringify([{ nope: 1 }])), () => 0).getSnapshot()).toEqual([]);
    });
});

describe("usePendingTx", () => {
    it("re-renders when an entry is added or resolved", () => {
        const store = createPendingTxStore(memoryStorage());
        const wrapper = ({ children }: { children: ReactNode }) => <PendingTxProvider store={store}>{children}</PendingTxProvider>;
        const { result } = renderHook(() => usePendingTx(), { wrapper });
        expect(result.current.entries).toEqual([]);

        act(() => store.add({ ...ENTRY, startedAt: Date.now() }));
        expect(result.current.entries).toHaveLength(1);

        act(() => store.resolve("H1", { status: "failed", reason: "Out of gas" }));
        expect(result.current.entries[0]).toMatchObject({ status: "failed", reason: "Out of gas" });
    });

    it("needs the provider", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() => renderHook(() => usePendingTx())).toThrow("PendingTxProvider");
    });
});
