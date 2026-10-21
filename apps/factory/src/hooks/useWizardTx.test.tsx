import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { PendingTxProvider, PendingTxStorage, PendingTxStore, createPendingTxStore } from "@/contexts/pending-tx";
import type { ChainTxResult, TxReader } from "@/lib/tx-lookup";

// The wallet side: useFactoryTx is mocked, each call is captured so a test drives its callbacks.
type Opts = {
    toasts?: boolean;
    onBroadcast?: (hash: string) => void;
    onSuccess?: (res: { txhash: string; height: number; code: number }) => void;
    onFailure?: (err: string, details?: { stage: string; txHash?: string; rawLog?: string; code?: number }) => void;
};
const { txMock, calls } = vi.hoisted(() => ({
    txMock: vi.fn(),
    calls: [] as Array<{ opts: Opts; resolve: (ok: boolean) => void }>,
}));
vi.mock("@/hooks/useFactoryTx", () => ({ useFactoryTx: () => ({ tx: txMock, progressTrack: "" }) }));
vi.mock("next/navigation", () => ({
    usePathname: () => "/token/new",
    useSearchParams: () => new URLSearchParams("return=%2Fx"),
}));

import { SLOW_AFTER_MS, useWizardTx } from "./useWizardTx";

const HREF = "/token/new?return=%2Fx";
const MSGS = [{ typeUrl: "/bze.tokenfactory.MsgCreateDenom", value: {} }];

function memoryStorage(initial: string | null = null): PendingTxStorage {
    let value = initial;
    return { read: () => value, write: (v) => { value = v; } };
}

let store: PendingTxStore;
let getTx: ReturnType<typeof vi.fn<(hash: string) => Promise<ChainTxResult | null>>>;
let reader: TxReader;
const onDone = vi.fn();
const onEdit = vi.fn();

function setup(build: () => typeof MSGS | undefined = () => MSGS) {
    const wrapper = ({ children }: { children: ReactNode }) => <PendingTxProvider store={store}>{children}</PendingTxProvider>;
    return renderHook(() => useWizardTx<{ ticker: string }>(build, { title: "Create token HONEY", onDone, onEdit, reader }), { wrapper });
}

const last = () => calls[calls.length - 1];

beforeEach(() => {
    calls.length = 0;
    txMock.mockReset();
    txMock.mockImplementation((_msgs: unknown, opts: Opts) => new Promise<boolean>((resolve) => { calls.push({ opts, resolve }); }));
    onDone.mockReset();
    onEdit.mockReset();
    store = createPendingTxStore(memoryStorage());
    getTx = vi.fn<(hash: string) => Promise<ChainTxResult | null>>(async () => null);
    reader = { getTx, searchTxs: vi.fn(async () => []) };
});

afterEach(() => {
    vi.useRealTimers();
});

describe("useWizardTx", () => {
    it("is idle until submitted, then asks for the wallet with toasts off", () => {
        const { result } = setup();
        expect(result.current.panelProps).toBeUndefined();

        act(() => result.current.submit({ ticker: "HONEY" }));
        expect(result.current.panelProps?.status).toBe("confirm");
        expect(txMock).toHaveBeenCalledWith(MSGS, expect.objectContaining({ toasts: false }));
    });

    it("does nothing while the answers can't build a message", () => {
        const { result } = setup(() => undefined);
        act(() => result.current.submit());
        expect(txMock).not.toHaveBeenCalled();
        expect(result.current.panelProps).toBeUndefined();
    });

    it("confirm → submitted → confirmed → Continue hands over the input and clears the entry", async () => {
        const { result } = setup();
        act(() => result.current.submit({ ticker: "HONEY" }));

        act(() => last().opts.onBroadcast?.("HASH1"));
        expect(result.current.panelProps).toMatchObject({ status: "submitted", hash: "HASH1" });
        expect(store.getSnapshot()).toEqual([expect.objectContaining({ href: HREF, hash: "HASH1", status: "pending", doneInput: { ticker: "HONEY" } })]);

        await act(async () => {
            last().opts.onSuccess?.({ txhash: "HASH1", height: 1234, code: 0 });
            last().resolve(true);
        });
        expect(result.current.panelProps).toMatchObject({ status: "confirmed", hash: "HASH1", height: 1234 });

        act(() => result.current.panelProps?.onContinue());
        expect(onDone).toHaveBeenCalledWith({ input: { ticker: "HONEY" }, hash: "HASH1", height: 1234 });
        expect(store.getSnapshot()).toEqual([]);
        expect(result.current.panelProps).toBeUndefined();
    });

    it("declined in the wallet: Try again signs again, Edit answers goes back to Review", async () => {
        const { result } = setup();
        act(() => result.current.submit({ ticker: "HONEY" }));
        await act(async () => {
            last().opts.onFailure?.("Request rejected", { stage: "sign", rawLog: "Request rejected" });
            last().resolve(false);
        });
        expect(result.current.panelProps?.status).toBe("declined");
        expect(store.getSnapshot()).toEqual([]);

        act(() => result.current.panelProps?.onRetry());
        expect(txMock).toHaveBeenCalledTimes(2);
        expect(result.current.panelProps?.status).toBe("confirm");

        await act(async () => {
            last().opts.onFailure?.("Request rejected", { stage: "sign" });
            last().resolve(false);
        });
        act(() => result.current.panelProps?.onEdit());
        expect(onEdit).toHaveBeenCalledOnce();
        expect(result.current.panelProps).toBeUndefined();
    });

    it("failed on chain: the plain reason, the raw log as details, the network fee spent", async () => {
        const { result } = setup();
        act(() => result.current.submit());
        act(() => last().opts.onBroadcast?.("HASH1"));
        await act(async () => {
            last().opts.onFailure?.("Out of gas", { stage: "chain", txHash: "HASH1", rawLog: "out of gas in location: x", code: 11 });
            last().resolve(false);
        });

        expect(result.current.panelProps).toMatchObject({
            status: "failed",
            hash: "HASH1",
            error: { reason: "Out of gas", details: "out of gas in location: x", feeSpent: true },
        });
    });

    it("a gas pre-flight refusal shows as failed with its reason and nothing spent", async () => {
        const { result } = setup();
        act(() => result.current.submit());
        await act(async () => {
            last().opts.onFailure?.("Not enough BZE for the network fee", { stage: "prepare" });
            last().resolve(false);
        });

        expect(result.current.panelProps).toMatchObject({ status: "failed", error: { reason: "Not enough BZE for the network fee" } });
        expect(result.current.panelProps?.error?.feeSpent).toBeFalsy();
        expect(result.current.panelProps?.hash).toBeUndefined();
    });

    it("60 s after broadcast with no result: Taking longer (the wait's own timeout keeps watching)", async () => {
        vi.useFakeTimers();
        const { result } = setup();
        act(() => result.current.submit());
        act(() => last().opts.onBroadcast?.("HASH1"));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(30_000);
            last().opts.onFailure?.("timeout", { stage: "timeout", txHash: "HASH1" });
            last().resolve(false);
        });
        expect(result.current.panelProps?.status).toBe("submitted");

        await act(async () => { await vi.advanceTimersByTimeAsync(SLOW_AFTER_MS - 30_000); });
        expect(result.current.panelProps?.status).toBe("slow");

        // Keep waiting restarts the 60 s.
        act(() => result.current.panelProps?.onKeepWaiting?.());
        expect(result.current.panelProps?.status).toBe("submitted");
        await act(async () => { await vi.advanceTimersByTimeAsync(SLOW_AFTER_MS); });
        expect(result.current.panelProps?.status).toBe("slow");
    });

    describe("Check transaction status", () => {
        async function slow() {
            vi.useFakeTimers();
            const view = setup();
            act(() => view.result.current.submit());
            act(() => last().opts.onBroadcast?.("HASH1"));
            await act(async () => { await vi.advanceTimersByTimeAsync(SLOW_AFTER_MS); });
            expect(view.result.current.panelProps?.status).toBe("slow");
            return view;
        }

        it("found and executed: Confirmed", async () => {
            const { result } = await slow();
            getTx.mockResolvedValue({ txhash: "HASH1", code: 0, height: 77, messages: [] });
            await act(async () => { await result.current.panelProps?.onCheckStatus?.(); });
            expect(getTx).toHaveBeenCalledWith("HASH1");
            expect(result.current.panelProps).toMatchObject({ status: "confirmed", height: 77 });
        });

        it("not found: still Taking longer", async () => {
            const { result } = await slow();
            await act(async () => { await result.current.panelProps?.onCheckStatus?.(); });
            expect(result.current.panelProps).toMatchObject({ status: "slow", checking: false });
        });

        it("found and refused: Failed with the chain's log", async () => {
            const { result } = await slow();
            getTx.mockResolvedValue({ txhash: "HASH1", code: 5, height: 77, rawLog: "insufficient funds", messages: [] });
            await act(async () => { await result.current.panelProps?.onCheckStatus?.(); });
            expect(result.current.panelProps).toMatchObject({
                status: "failed",
                error: { reason: "insufficient funds", details: "insufficient funds", feeSpent: true },
            });
        });
    });

    it("coming back to the page: shows the stored hash, checks it, and Continue uses the stored input", async () => {
        store.add({ href: HREF, hash: "HASH9", title: "Create token HONEY", startedAt: Date.now(), doneInput: { ticker: "HONEY" } });
        getTx.mockResolvedValue({ txhash: "HASH9", code: 0, height: 500, messages: [] });

        const { result } = setup();
        expect(result.current.panelProps).toMatchObject({ status: "submitted", hash: "HASH9" });
        await act(async () => { await Promise.resolve(); });

        expect(getTx).toHaveBeenCalledWith("HASH9");
        expect(result.current.panelProps).toMatchObject({ status: "confirmed", height: 500 });
        act(() => result.current.panelProps?.onContinue());
        expect(onDone).toHaveBeenCalledWith({ input: { ticker: "HONEY" }, hash: "HASH9", height: 500 });
    });

    it("ignores a stored transaction of another wizard page", () => {
        store.add({ href: "/pool/new", hash: "OTHER", title: "Create pool", startedAt: Date.now() });
        const { result } = setup();
        expect(result.current.panelProps).toBeUndefined();
    });
});
