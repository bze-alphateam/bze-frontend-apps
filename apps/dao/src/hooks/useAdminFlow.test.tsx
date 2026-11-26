import {describe, expect, it, vi} from "vitest";
import {act, renderHook} from "@testing-library/react";
import type {EncodeObject} from "@bze/bzejs/types";
import {buildNominateAdminMsg, daoTxOptions, prettyError, type TxLanding, type TxOptions} from "@bze/bze-ui-kit";
import {OTHER, WALLET} from "@/test/composer-fixtures";
import {adminPendingKey} from "@/lib/admin/pending";
import type {SignAndSend} from "@/lib/dao-tx";
import type {DraftStorage} from "@/lib/propose/draft";
import {useAdminFlow, type AdminFlowDeps} from "./useAdminFlow";

const HASH = "AB".repeat(32);
const MSGS: EncodeObject[] = [buildNominateAdminMsg({authority: WALLET, daoId: "4", nominee: OTHER})];

const memory = (): DraftStorage & {data: Map<string, string>} => {
    const data = new Map<string, string>();
    return {data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k)};
};

/** A signer that ends the way ui-kit's does: it calls the callbacks of its options and says whether it was sent. */
const signer = (end: (o: TxOptions) => boolean): SignAndSend => vi.fn(async (_msgs: EncodeObject[], o?: TxOptions) => end(o ?? {}));
const refuses = (rawLog: string) => signer((o) => {
    o.onFailure?.(prettyError(`failed to execute message; message index: 0: ${rawLog}`), {stage: "prepare", rawLog});
    return false;
});

const setup = (sign: SignAndSend, over: Partial<AdminFlowDeps> = {}) => {
    const storage = memory();
    const deps: AdminFlowDeps = {
        sign, daoId: "4", wallet: WALLET, storage,
        refresh: vi.fn(async () => "ok" as const),
        fingerprint: () => `${WALLET}||0|0`,
        lookupTx: vi.fn(async (): Promise<TxLanding> => "notfound"),
        ...over,
    };
    return {deps, storage, hook: renderHook((props: AdminFlowDeps) => useAdminFlow(props), {initialProps: deps})};
};

describe("a simulation the chain refuses signs nothing and says why, in words", () => {
    it.each([
        ["1109 not the admin", "dao 4 is administered by bze1other: signer is not the dao's admin", /Only this DAO's admin can do that/],
        ["1112 a nomination is pending", "dao 4 already nominated bze1x: an admin nomination is already pending", /Withdraw it before nominating someone else/],
        ["1133 a message the admin may not run", "message 0 (/cosmos.authz.v1beta1.MsgGrant): the message is not allowed in this dao execution", /can't grant permissions or fee allowances/],
        ["1134 nested too deep", "at most 5 nested dao executions: dao executions are nested too deep", /nested too deep/],
        ["1135 a stale nomination", "dao 4 changed its admin after dao 9 nominated x: the admin nomination is stale", /no longer valid/],
        ["1115 nothing to withdraw", "dao 4: no admin nomination is pending", /no pending admin nomination/],
    ])("%s", async (_name, log, expected) => {
        const sign = refuses(log);
        const {hook, deps, storage} = setup(sign);
        await act(async () => { await hook.result.current.run("nominate", MSGS); });

        expect(sign).toHaveBeenCalledTimes(1);
        expect(sign).toHaveBeenCalledWith(MSGS, expect.objectContaining({...daoTxOptions, toasts: false}));
        const {state} = hook.result.current.flow;
        expect(state).toMatchObject({phase: "failed", kind: "nominate"});
        expect(state.phase === "failed" && state.error).toMatch(expected);
        // nothing was broadcast: nothing to look up, nothing remembered, and the console is open again
        expect(deps.refresh).not.toHaveBeenCalled();
        expect(storage.data.size).toBe(0);
        expect(hook.result.current.flow.locked).toBe(false);
    });
});

describe("a transaction that landed", () => {
    it("re-reads the DAO and says it is sent", async () => {
        const {hook, deps} = setup(signer((o) => { o.onBroadcast?.(HASH); o.onSuccess?.({height: 1, txhash: HASH, code: 0}); return true; }));
        await act(async () => { await hook.result.current.run("hand-over", MSGS); });
        expect(deps.refresh).toHaveBeenCalledTimes(1);
        expect(hook.result.current.flow.state).toEqual({phase: "sent", kind: "hand-over", txHash: HASH, reread: "ok", batches: 0});
    });
});

describe("a confirmation timeout", () => {
    const timeout = () => signer((o) => { o.onBroadcast?.(HASH); o.onFailure?.("slow", {stage: "timeout", txHash: HASH}); return false; });

    it("locks every operation, refuses a second send, and remembers the hash for a reload", async () => {
        const sign = timeout();
        const {hook, storage} = setup(sign);
        await act(async () => { await hook.result.current.run("admin-execute", MSGS); });

        expect(hook.result.current.flow.state).toMatchObject({phase: "unconfirmed", kind: "admin-execute", txHash: HASH});
        expect(hook.result.current.flow.locked).toBe(true);
        expect(JSON.parse(storage.data.get(adminPendingKey("4", WALLET))!)).toMatchObject({hash: HASH, kind: "admin-execute"});

        await act(async () => { await hook.result.current.run("nominate", MSGS); });
        expect(sign).toHaveBeenCalledTimes(1);
    });

    it("a reload restores the lock before anything can be sent, and a payment is judged by its hash", async () => {
        const first = timeout();
        const {hook, storage, deps} = setup(first);
        await act(async () => { await hook.result.current.run("admin-execute", MSGS); });

        // the page is loaded again: same storage, fresh hook
        const second = signer(() => true);
        const reloaded = renderHook(() => useAdminFlow({...deps, sign: second, lookupTx: vi.fn(async (): Promise<TxLanding> => "landed")}));
        expect(reloaded.result.current.flow.state).toMatchObject({phase: "unconfirmed", kind: "admin-execute", txHash: HASH});
        expect(reloaded.result.current.flow.locked).toBe(true);
        await act(async () => { await reloaded.result.current.run("admin-execute", MSGS); });
        expect(second).not.toHaveBeenCalled();

        // the node knows it: it landed, and the memory is dropped
        await act(async () => { await reloaded.result.current.flow.recheck(); });
        expect(reloaded.result.current.flow.state).toMatchObject({phase: "sent", kind: "admin-execute", txHash: HASH});
        expect(storage.data.size).toBe(0);
    });

    it("an admin execute does not change the DAO record, so an unchanged record proves nothing: only the node reopens it", async () => {
        const lookupTx = vi.fn(async (): Promise<TxLanding> => "notfound");
        const {hook, storage} = setup(timeout(), {lookupTx});
        await act(async () => { await hook.result.current.run("admin-execute", MSGS); });
        await act(async () => { await hook.result.current.flow.recheck(); });

        expect(lookupTx).toHaveBeenCalledWith(HASH);
        expect(hook.result.current.flow.state).toEqual({phase: "rechecked", kind: "admin-execute", txHash: HASH});
        expect(hook.result.current.flow.locked).toBe(false);
        expect(storage.data.size).toBe(0);
    });

    it("the chain refusing what the node saw reopens the console with that said", async () => {
        const {hook} = setup(timeout(), {lookupTx: vi.fn(async (): Promise<TxLanding> => "failed")});
        await act(async () => { await hook.result.current.run("admin-execute", MSGS); });
        await act(async () => { await hook.result.current.flow.recheck(); });
        expect(hook.result.current.flow.state).toMatchObject({phase: "failed", error: expect.stringMatching(/chain refused/)});
        expect(hook.result.current.flow.locked).toBe(false);
    });

    it("a node that cannot be asked keeps it locked", async () => {
        const {hook} = setup(timeout(), {lookupTx: vi.fn(async () => { throw new Error("rest"); })});
        await act(async () => { await hook.result.current.run("admin-execute", MSGS); });
        await act(async () => { await hook.result.current.flow.recheck(); });
        expect(hook.result.current.flow.locked).toBe(true);
        expect(hook.result.current.flow.state).toMatchObject({phase: "unconfirmed", note: expect.stringMatching(/node could not be asked/)});
    });

    it("a handover is also seen in the DAO record: the nomination shows, so it landed", async () => {
        let nominated = false;
        const {hook} = setup(timeout(), {fingerprint: () => `${WALLET}|${nominated ? OTHER : ""}|0|1`});
        await act(async () => { await hook.result.current.run("nominate", MSGS); });
        nominated = true;
        await act(async () => { await hook.result.current.flow.recheck(); });
        expect(hook.result.current.flow.state).toMatchObject({phase: "sent", kind: "nominate", txHash: HASH});
    });

    it("another wallet's or DAO's pending transaction does not lock this console", async () => {
        const {storage, deps} = setup(timeout());
        storage.setItem(adminPendingKey("5", WALLET), JSON.stringify({v: 1, hash: HASH, kind: "accept"}));
        storage.setItem(adminPendingKey("4", OTHER), JSON.stringify({v: 1, hash: HASH, kind: "accept"}));
        const {result} = renderHook(() => useAdminFlow(deps));
        expect(result.current.flow.state).toEqual({phase: "idle"});
    });
});
